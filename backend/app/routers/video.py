import json
import logging
import threading
import urllib.parse

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import Project, ProjectStatus, Scene, Script, Timeline
from app.schemas import (
    MessageResponse,
    MusicSuggestionResponse,
    MusicTrackResponse,
    VideoBuildRequest,
    VideoClipResponse,
    VideoStatusResponse,
)
from app.services.ai import ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video", tags=["Video"])


@router.get("/ratios")
def list_video_ratios():
    from app.services.video import video_service

    return {"default": "16:9", "ratios": video_service.ratio_list()}


@router.get("/music/library", response_model=list[MusicTrackResponse])
def list_global_music():
    from app.services.video import video_service

    return video_service.list_global_music()


@router.post("/music/upload", response_model=MusicTrackResponse)
async def upload_global_music(file: UploadFile = File(...)):
    from app.services.video import video_service

    valid_exts = {".mp3", ".wav", ".aac", ".ogg", ".m4a", ".flac"}
    import os
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in valid_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid audio format '{ext}'. Supported formats: {', '.join(sorted(valid_exts))}",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    track = video_service.save_global_music(file.filename or "track.mp3", content)
    return track


@router.delete("/music/{filename}")
def delete_global_music(filename: str):
    from app.services.video import video_service

    deleted = video_service.delete_global_music(filename)
    if not deleted:
        raise HTTPException(status_code=404, detail="Audio file not found")
    return {"message": f"Deleted '{filename}'"}


@router.get("/clips/library", response_model=list[VideoClipResponse])
def list_global_clips():
    from app.services.video import video_service

    return video_service.list_global_clips()


@router.post("/clips/upload", response_model=VideoClipResponse)
async def upload_global_clip(file: UploadFile = File(...)):
    from app.services.video import video_service

    valid_exts = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}
    import os

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in valid_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid video format '{ext}'. Supported formats: {', '.join(sorted(valid_exts))}",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    clip = video_service.save_global_clip(file.filename or "clip.mp4", content)
    return clip


@router.delete("/clips/{filename}")
def delete_global_clip(filename: str):
    from app.services.video import video_service

    deleted = video_service.delete_global_clip(filename)
    if not deleted:
        raise HTTPException(status_code=404, detail="Video clip not found")
    return {"message": f"Deleted '{filename}'"}


@router.get("/project/{project_id}/music/suggest", response_model=MusicSuggestionResponse)
def suggest_project_music(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    script = (
        db.query(Script)
        .filter(Script.project_id == project_id, Script.is_active.is_(True))
        .order_by(Script.id.desc())
        .first()
    )
    title = script.title if script else project.name
    body = script.body if script else (project.description or "")

    ai_data = ai_service.recommend_music(
        script_title=title,
        script_body=body,
        category=project.category,
        language=project.language,
    )

    keywords = ai_data.get("search_keywords", f"{title} background music royalty free")
    encoded_keywords = urllib.parse.quote_plus(keywords)

    search_urls = {
        "pixabay": f"https://pixabay.com/music/search/{encoded_keywords}/",
        "youtube": f"https://www.youtube.com/results?search_query={encoded_keywords}",
        "freemusicarchive": f"https://freemusicarchive.org/search?quicksearch={encoded_keywords}",
    }

    return MusicSuggestionResponse(
        mood=ai_data.get("mood", "Chill / Ambient"),
        search_keywords=keywords,
        genre_tags=ai_data.get("genre_tags", ["ambient", "chill"]),
        recommended_volume=ai_data.get("recommended_volume", 0.12),
        explanation=ai_data.get("explanation", "Matches video topic and tone."),
        search_urls=search_urls,
    )


@router.get("/project/{project_id}/status", response_model=VideoStatusResponse)
def video_build_status(project_id: int, db: Session = Depends(get_db)):
    from app.services.video import video_service

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return video_service.get_progress(project.slug)


def _load_timeline_payload(db: Session, project_id: int) -> dict | None:
    tl = db.query(Timeline).filter(Timeline.project_id == project_id).first()
    if not tl or not tl.data:
        return None
    try:
        parsed = json.loads(tl.data)
    except (ValueError, TypeError):
        return None
    if not isinstance(parsed, dict):
        return None
    return parsed


def _run_build(
    project_id: int,
    slug: str,
    scene_data: list[dict],
    payload: VideoBuildRequest,
    timeline_clips: list[dict] | None = None,
    track_states: dict | None = None,
    background_music: str | None = None,
    music_volume: float = 0.12,
) -> None:
    from app.services.video import video_service

    try:
        video_path = video_service.build_video(
            slug=slug,
            scenes=scene_data,
            background_music=payload.background_music,
            music_volume=payload.music_volume,
            ratio=payload.ratio,
            resolution=payload.resolution,
            subtitles=payload.subtitles,
            subtitle_style=payload.subtitle_style,
            subtitle_position=payload.subtitle_position,
            subtitle_color=payload.subtitle_color,
            subtitle_outline_color=payload.subtitle_outline_color,
            subtitle_outline=payload.subtitle_outline,
            subtitle_font_size=payload.subtitle_font_size,
            force_rebuild=payload.force_rebuild,
            timeline_clips=timeline_clips,
            track_states=track_states,
        )
        db = SessionLocal()
        try:
            project = db.query(Project).filter(Project.id == project_id).first()
            if project:
                project.status = ProjectStatus.VIDEO
                db.commit()
        finally:
            db.close()
        logger.info("Video build finished for project %s -> %s", slug, video_path)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Video build failed for project %s", slug)
        video_service.set_progress(
            slug, 0, "error", "Video build failed.", running=False, error=str(exc)
        )


@router.post("/project/{project_id}/build", response_model=MessageResponse)
def build_video(
    project_id: int, payload: VideoBuildRequest, db: Session = Depends(get_db)
):
    from app.services.video import video_service

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order_index)
        .all()
    )
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found.")

    if video_service.get_progress(project.slug)["running"]:
        raise HTTPException(status_code=409, detail="A video build is already running.")

    scene_data = [
        {
            "id": s.id,
            "order_index": s.order_index,
            "image_path": s.image_path,
            "images": [
                {"file_path": img.file_path, "position": img.position}
                for img in s.scene_images
            ],
            "video_path": s.video_path,
            "videos": [
                {"file_path": vid.file_path, "position": vid.position}
                for vid in s.scene_videos
            ],
            "audio_path": s.audio_path,
            "duration_seconds": s.duration_seconds,
            "motion_effect": s.motion_effect,
            "narration": s.narration,
        }
        for s in scenes
    ]

    timeline_payload = _load_timeline_payload(db, project_id)
    background_music = payload.background_music
    music_volume = payload.music_volume
    # Try from request timeline first, then from DB timeline
    req_timeline = payload.timeline.model_dump() if payload.timeline else None
    for source in (req_timeline, timeline_payload):
        if (
            not background_music
            and source
            and isinstance(source.get("music"), dict)
            and source["music"].get("file_path")
        ):
            background_music = source["music"]["file_path"]
            music_volume = float(source["music"].get("volume", music_volume))
            break
    timeline_clips = timeline_payload["clips"] if timeline_payload else (req_timeline["clips"] if req_timeline else None)
    track_states = (
        timeline_payload.get("track_states") if timeline_payload
        else (req_timeline.get("track_states") if req_timeline else None)
    )

    video_service.set_progress(
        project.slug, 0, "starting", "Starting video build..."
    )
    thread = threading.Thread(
        target=_run_build,
        args=(project_id, project.slug, scene_data, payload, timeline_clips, track_states, background_music, music_volume),
        daemon=True,
    )
    thread.start()

    return MessageResponse(
        message="Video build started",
        detail=f"Build started for {len(scenes)} scene(s). Track progress via /video/project/{project_id}/status",
    )
