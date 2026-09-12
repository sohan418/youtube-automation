from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.config import settings
from app.database import get_db
from app.models import Project, SEOMetadata, Thumbnail
from app.services.storage import storage_service
from app.services.youtube import youtube_service

router = APIRouter(prefix="/youtube", tags=["YouTube"])


class YouTubeConfigUpdate(BaseModel):
    youtube_api_key: str | None = None
    youtube_playlist_id: str | None = None
    youtube_client_id: str | None = None
    youtube_client_secret: str | None = None


class YouTubeUploadRequest(BaseModel):
    privacy_status: str = "private"
    publish_at: str | None = None


class YouTubeVideoResponse(BaseModel):
    title: str
    description: str
    published_at: str
    video_id: str
    channel_title: str


@router.get("/config")
def get_youtube_config():
    return {
        "youtube_api_key_configured": bool(settings.youtube_api_key),
        "youtube_playlist_id": settings.youtube_playlist_id,
        "youtube_client_id_configured": bool(settings.youtube_client_id),
        "youtube_client_secret_configured": bool(settings.youtube_client_secret),
        "youtube_connected": youtube_service.is_connected(),
    }


@router.post("/config")
def update_youtube_config(payload: YouTubeConfigUpdate):
    to_update: dict[str, str] = {}
    if payload.youtube_api_key is not None and payload.youtube_api_key.strip():
        to_update["youtube_api_key"] = payload.youtube_api_key.strip()
    if payload.youtube_playlist_id is not None:
        from app.services.youtube import normalize_playlist_id

        to_update["youtube_playlist_id"] = (
            normalize_playlist_id(payload.youtube_playlist_id) or ""
        )
    if payload.youtube_client_id is not None and payload.youtube_client_id.strip():
        to_update["youtube_client_id"] = payload.youtube_client_id.strip()
    if payload.youtube_client_secret is not None and payload.youtube_client_secret.strip():
        to_update["youtube_client_secret"] = payload.youtube_client_secret.strip()
    if to_update:
        settings.update_api_keys(to_update)
    return get_youtube_config()


@router.get("/recent", response_model=list[YouTubeVideoResponse])
def get_recent_videos(max_results: int = 10):
    return youtube_service.fetch_recent_videos(max_results=max_results)


@router.get("/auth/url")
def get_auth_url():
    if not settings.youtube_client_id or not settings.youtube_client_secret:
        raise HTTPException(status_code=400, detail="YouTube OAuth client ID and secret not configured.")
    url = youtube_service.get_auth_url()
    return {"url": url}


@router.get("/auth/callback")
def auth_callback(code: str):
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    ok = youtube_service.handle_callback(code)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to exchange authorization code")
    return RedirectResponse(url="http://localhost:5173", status_code=302)


@router.get("/channel")
def get_channel():
    if not youtube_service.is_connected():
        return {"connected": False}
    info = youtube_service.get_channel_info()
    if not info:
        return {"connected": False}
    return {"connected": True, **info}


@router.get("/verify")
def verify_connection():
    """Real connection status: verifies the stored token against the YouTube API.

    Distinguishes 'not connected' (no tokens) from a bad/expired token that
    requires the user to reconnect via OAuth.
    """
    stored = youtube_service.is_connected()
    if not stored:
        return {
            "connected": False,
            "needs_reconnect": False,
            "reason": "not_connected",
        }
    ok = youtube_service.verify_connection()
    if ok:
        return {
            "connected": True,
            "needs_reconnect": False,
            "reason": "ok",
        }
    return {
        "connected": False,
        "needs_reconnect": True,
        "reason": "token_expired_or_revoked",
    }


@router.post("/upload/{project_id}")
def upload_video(project_id: int, payload: YouTubeUploadRequest):
    db = next(get_db())
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not youtube_service.verify_connection():
        raise HTTPException(status_code=400, detail="YouTube not connected. Please authenticate first.")

    # Find final video dynamically
    video_dir = storage_service.get_project_path(project.slug) / "video"
    final_video = video_dir / "final.mp4"
    if not final_video.exists() or final_video.stat().st_size <= 1024:
        for alt_name in ("final_post.mp4", "final_narr.mp4", "final_watermarked.mp4", "final_subtitled.mp4"):
            alt = video_dir / alt_name
            if alt.exists() and alt.stat().st_size > 1024:
                final_video = alt
                break

    if not final_video.exists() or final_video.stat().st_size <= 1024:
        mp4s = sorted(
            [f for f in video_dir.glob("*.mp4") if f.stat().st_size > 1024],
            key=lambda f: f.stat().st_mtime,
            reverse=True,
        )
        if mp4s:
            final_video = mp4s[0]

    if not final_video.exists() or final_video.stat().st_size <= 1024:
        raise HTTPException(status_code=400, detail="Video not built yet. Please build the video first.")

    # Get SEO metadata
    seo = db.query(SEOMetadata).filter(SEOMetadata.project_id == project_id).first()
    title = seo.title if seo and seo.title else project.name
    description = seo.description if seo and seo.description else ""
    tags_str = seo.tags if seo and seo.tags else ""
    tags = [t.strip() for t in tags_str.replace("\n", ",").split(",") if t.strip()] if tags_str else []
    category_id = str(seo.category_id) if seo and seo.category_id else "22"

    # Find thumbnail: prefer the user-selected one
    selected = (
        db.query(Thumbnail)
        .filter(Thumbnail.project_id == project_id)
        .order_by(Thumbnail.is_selected.desc(), Thumbnail.id.desc())
        .first()
    )
    thumbnail_path = None
    if selected and selected.file_path:
        p_str = selected.file_path
        p_path = Path(p_str)
        if p_path.is_absolute() and p_path.exists():
            thumbnail_path = str(p_path)
        else:
            c1 = storage_service.root.parent / p_str
            c2 = storage_service.root / p_str
            if c1.exists():
                thumbnail_path = str(c1)
            elif c2.exists():
                thumbnail_path = str(c2)

    if not thumbnail_path:
        thumb_dir = storage_service.get_project_path(project.slug) / "thumbnail"
        if thumb_dir.exists():
            files = sorted(
                [f for f in thumb_dir.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")],
                key=lambda f: f.stat().st_mtime,
                reverse=True,
            )
            if files:
                thumbnail_path = str(files[0])

    youtube_service.upload_video(
        project_slug=project.slug,
        video_path=str(final_video),
        title=title,
        description=description,
        tags=tags,
        category_id=category_id,
        privacy_status=payload.privacy_status,
        publish_at=payload.publish_at,
        thumbnail_path=thumbnail_path,
    )

    return {"message": "Upload started", "slug": project.slug}


@router.get("/upload/{project_id}/status")
def upload_status(project_id: int):
    db = next(get_db())
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return youtube_service.get_upload_progress(project.slug)
