from __future__ import annotations

import json
import hashlib
import base64
import logging
from pathlib import Path
import secrets
import threading
import time
from datetime import datetime, timezone
try:
    from PIL import Image, ImageDraw, ImageOps
except ImportError:
    Image = None  # type: ignore
    ImageDraw = None  # type: ignore
    ImageOps = None  # type: ignore
from typing import Any

import httpx
try:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
except ImportError:
    Credentials = None
    build = None
    MediaFileUpload = None

from app.config import BACKEND_DIR, settings
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]
REDIRECT_URI = "http://localhost:8000/api/youtube/auth/callback"

# Upload progress tracking (same pattern as video build)
_upload_progress: dict[str, dict[str, Any]] = {}
# PKCE code verifier storage (temporary, per-instance)
_auth_code_verifier: str | None = None


def normalize_playlist_id(val: str | None) -> str | None:
    if not val:
        return None
    val = val.strip()
    if not val:
        return None
    if "youtube.com" in val or "youtu.be" in val:
        if "list=" in val:
            import urllib.parse
            parsed = urllib.parse.urlparse(val)
            query = urllib.parse.parse_qs(parsed.query)
            if "list" in query and query["list"]:
                val = query["list"][0]
        elif "/channel/" in val:
            val = val.split("/channel/")[-1].split("/")[0].split("?")[0]

    if val.startswith("UC") and len(val) == 24:
        val = "UU" + val[2:]

    return val


class YouTubeService:
    def __init__(self) -> None:
        self._client = httpx.Client(timeout=15)

    def _get_credentials(self) -> Credentials | None:
        if not settings.youtube_access_token and not settings.youtube_refresh_token:
            return None
        expiry = None
        if settings.youtube_token_expiry:
            try:
                expiry = datetime.fromisoformat(settings.youtube_token_expiry)
                if expiry.tzinfo is not None:
                    expiry = expiry.replace(tzinfo=None)
            except (ValueError, TypeError):
                expiry = None
        return Credentials(
            token=settings.youtube_access_token,
            refresh_token=settings.youtube_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.youtube_client_id,
            client_secret=settings.youtube_client_secret,
            expiry=expiry,
        )

    def _refresh_credentials(self, creds: Credentials) -> None:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        settings.update_api_key("youtube_access_token", creds.token or "")
        settings.update_api_key("youtube_refresh_token", creds.refresh_token or "")
        if creds.expiry:
            settings.update_api_key("youtube_token_expiry", creds.expiry.isoformat())

    def _ensure_fresh(self, creds: Credentials) -> None:
        """Refresh token if needed, avoiding timezone comparison issues."""
        if not creds.refresh_token or not creds.client_id or not creds.client_secret:
            return
        try:
            is_expired = creds.expired
        except TypeError:
            is_expired = True  # timezone mismatch = treat as expired
        if is_expired:
            try:
                self._refresh_credentials(creds)
            except Exception as e:
                logger.warning("Token refresh skipped: %s", e)

    def is_connected(self) -> bool:
        """Quick check: do we have tokens stored?"""
        return bool(settings.youtube_access_token and settings.youtube_refresh_token)

    def verify_connection(self) -> bool:
        """Full check: can we actually reach the YouTube API?"""
        creds = self._get_credentials()
        if not creds:
            return False
        try:
            # Force refresh if expired (handles timezone issues)
            if creds.refresh_token:
                from google.auth.transport.requests import Request
                try:
                    creds.refresh(Request())
                except Exception:
                    pass  # If refresh fails with existing token, try using it as-is
            youtube = build("youtube", "v3", credentials=creds)
            resp = youtube.channels().list(part="id", mine=True).execute()
            return bool(resp.get("items"))
        except Exception:
            logger.warning("YouTube connection verification failed")
            return False

    def get_channel_info(self) -> dict[str, Any] | None:
        creds = self._get_credentials()
        if not creds:
            return None
        try:
            self._ensure_fresh(creds)
            youtube = build("youtube", "v3", credentials=creds)
            resp = youtube.channels().list(part="snippet,statistics", mine=True).execute()
            items = resp.get("items", [])
            if not items:
                return None
            ch = items[0]
            snippet = ch.get("snippet", {})
            stats = ch.get("statistics", {})
            thumbnails = snippet.get("thumbnails", {})
            avatar_url = (
                thumbnails.get("high", {}).get("url")
                or thumbnails.get("medium", {}).get("url")
                or thumbnails.get("default", {}).get("url")
                or ""
            )
            return {
                "channel_id": ch.get("id", ""),
                "title": snippet.get("title", ""),
                "description": snippet.get("description", ""),
                "avatar": avatar_url,
                "subscribers": stats.get("subscriberCount", "0"),
                "videos": stats.get("videoCount", "0"),
            }
        except Exception:
            logger.exception("Failed to get YouTube channel info")
            return None

    def _ensure_circular_logo(self, logo_path: Path):
        """Crop logo to center square and apply smooth anti-aliased circular alpha mask."""
        if not logo_path.exists() or logo_path.stat().st_size < 50:
            return
        try:
            from PIL import Image, ImageDraw
            img = Image.open(logo_path).convert("RGBA")
            S = min(img.width, img.height)
            if S <= 0:
                return

            left = (img.width - S) // 2
            top = (img.height - S) // 2
            cropped = img.crop((left, top, left + S, top + S))

            mask = Image.new("L", (S * 2, S * 2), 0)
            draw = ImageDraw.Draw(mask)
            draw.ellipse((0, 0, S * 2 - 1, S * 2 - 1), fill=255)
            resample_filter = getattr(Image, "Resampling", Image).LANCZOS
            mask = mask.resize((S, S), resample_filter)

            circular = Image.new("RGBA", (S, S), (0, 0, 0, 0))
            circular.paste(cropped, (0, 0), mask)
            circular.save(logo_path, "PNG")
        except Exception:
            logger.exception("Failed to apply circular mask to logo at %s", logo_path)

    def _create_default_logo(self, logo_path: Path):
        """No-op: do not generate fake placeholder logo."""
        pass

    def get_channel_logo_path(self, project_slug: str, force_refresh: bool = False) -> Path | None:
        """Download & cache the connected channel's logo or use uploaded project logo."""
        branding_dir = storage_service.get_project_path(project_slug) / "branding"
        logo = branding_dir / "logo.png"

        # 1. Use existing custom project logo if present
        if logo.exists() and logo.stat().st_size > 100:
            return logo

        # 2. Try fetching from YouTube channel avatar if connected
        try:
            info = self.get_channel_info()
            avatar = (info or {}).get("avatar", "")
            if avatar:
                resp = httpx.Client(timeout=15).get(avatar)
                resp.raise_for_status()
                if len(resp.content) > 100:
                    branding_dir.mkdir(parents=True, exist_ok=True)
                    logo.write_bytes(resp.content)
                    self._ensure_circular_logo(logo)
                    return logo
        except Exception:
            logger.exception(f"Failed to download YouTube channel logo for {project_slug}")

        return None

    def get_auth_url(self) -> str:
        global _auth_code_verifier
        code_verifier = secrets.token_urlsafe(64)
        _auth_code_verifier = code_verifier
        code_challenge = base64.urlsafe_b64encode(
            hashlib.sha256(code_verifier.encode()).digest()
        ).decode().rstrip("=")

        params = {
            "client_id": settings.youtube_client_id,
            "redirect_uri": REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"

    def handle_callback(self, code: str) -> bool:
        global _auth_code_verifier
        if not _auth_code_verifier:
            logger.error("No code verifier found for OAuth callback")
            return False
        try:
            resp = self._client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.youtube_client_id,
                    "client_secret": settings.youtube_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": REDIRECT_URI,
                    "code_verifier": _auth_code_verifier,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            settings.update_api_key("youtube_access_token", data.get("access_token", ""))
            settings.update_api_key("youtube_refresh_token", data.get("refresh_token", ""))
            if data.get("expires_in"):
                from datetime import datetime, timedelta, timezone
                expiry = datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"])
                settings.update_api_key("youtube_token_expiry", expiry.isoformat())
            return True
        except Exception:
            logger.exception("YouTube OAuth callback failed")
            return False

    handle_auth_callback = handle_callback

    def fetch_recent_videos(self, playlist_id: str | None = None, max_results: int = 10) -> list[dict[str, Any]]:
        api_key = settings.youtube_api_key
        raw_pid = playlist_id or settings.youtube_playlist_id
        pid = normalize_playlist_id(raw_pid)
        if pid and pid != settings.youtube_playlist_id:
            settings.update_api_key("youtube_playlist_id", pid)

        creds = self._get_credentials()

        # If playlist_id is missing, try auto-discovering uploads playlist via OAuth
        if not pid and creds:
            try:
                self._ensure_fresh(creds)
                youtube = build("youtube", "v3", credentials=creds)
                ch_resp = youtube.channels().list(part="contentDetails", mine=True).execute()
                items = ch_resp.get("items", [])
                if items:
                    pid = items[0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
                    pid = normalize_playlist_id(pid)
                    if pid:
                        settings.update_api_key("youtube_playlist_id", pid)
            except Exception as ch_err:
                logger.warning("Could not auto-fetch channel uploads playlist: %s", ch_err)

        # 1. Try OAuth playlistItems fetch if connected
        if creds and pid:
            try:
                self._ensure_fresh(creds)
                youtube = build("youtube", "v3", credentials=creds)
                resp = youtube.playlistItems().list(
                    part="snippet,contentDetails",
                    playlistId=pid,
                    maxResults=min(max_results, 50),
                ).execute()
                videos: list[dict[str, Any]] = []
                for item in resp.get("items", []):
                    snippet = item.get("snippet", {})
                    content = item.get("contentDetails", {})
                    videos.append({
                        "title": snippet.get("title", ""),
                        "description": snippet.get("description", ""),
                        "published_at": snippet.get("publishedAt", ""),
                        "video_id": content.get("videoId", ""),
                        "channel_title": snippet.get("channelTitle", ""),
                    })
                return videos
            except Exception as oauth_err:
                logger.warning("OAuth fetch_recent_videos failed: %s, trying API key fallback", oauth_err)

        # 2. Fallback to API Key fetch
        if not api_key or not pid:
            return []

        try:
            resp = self._client.get(
                f"{YOUTUBE_API_BASE}/playlistItems",
                params={
                    "part": "snippet,contentDetails",
                    "playlistId": pid,
                    "maxResults": min(max_results, 50),
                    "key": api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            videos: list[dict[str, Any]] = []
            for item in data.get("items", []):
                snippet = item.get("snippet", {})
                content = item.get("contentDetails", {})
                videos.append({
                    "title": snippet.get("title", ""),
                    "description": snippet.get("description", ""),
                    "published_at": snippet.get("publishedAt", ""),
                    "video_id": content.get("videoId", ""),
                    "channel_title": snippet.get("channelTitle", ""),
                })
            return videos
        except Exception:
            logger.exception("Failed to fetch YouTube playlist items via API key")

        # 3. Fallback to existing database projects / scripts history if YouTube API is unavailable
        try:
            from app.database import SessionLocal
            from app.models import Project, Script
            db = SessionLocal()
            db_videos: list[dict[str, Any]] = []
            try:
                db_projects = db.query(Project).order_by(Project.created_at.desc()).limit(max_results).all()
                for p in db_projects:
                    s = db.query(Script).filter(Script.project_id == p.id).first()
                    db_videos.append({
                        "title": s.title if s else p.name,
                        "description": s.body[:120] if s and s.body else (p.description or ""),
                    })
            finally:
                db.close()
            return db_videos
        except Exception as db_err:
            logger.warning("DB fallback for recent videos failed: %s", db_err)
            return []

    def upload_video(
        self,
        project_slug: str,
        video_path: str,
        title: str,
        description: str,
        tags: list[str],
        category_id: str,
        privacy_status: str = "private",
        thumbnail_path: str | None = None,
        publish_at: str | None = None,
    ) -> None:
        """Upload video in a background thread. Tracks progress in _upload_progress."""
        key = project_slug
        _upload_progress[key] = {
            "running": True,
            "progress": 0,
            "stage": "starting",
            "message": "Preparing upload...",
            "video_id": None,
            "video_url": None,
            "error": None,
        }

        def _do_upload() -> None:
            try:
                creds = self._get_credentials()
                if not creds:
                    raise RuntimeError("YouTube not connected. Please authenticate first.")
                self._ensure_fresh(creds)

                _upload_progress[key].update(stage="uploading", message="Uploading video...")

                youtube = build("youtube", "v3", credentials=creds)

                status_dict: dict[str, Any] = {
                    "privacyStatus": "private" if publish_at else privacy_status,
                    "selfDeclaredMadeForKids": False,
                }
                if publish_at:
                    status_dict["publishAt"] = publish_at

                body = {
                    "snippet": {
                        "title": title[:100],
                        "description": description[:5000],
                        "tags": tags[:30] if tags else [],
                        "categoryId": str(category_id) if category_id else "22",
                    },
                    "status": status_dict,
                }

                abs_path = str(Path(video_path).resolve()) if not Path(video_path).is_absolute() else video_path
                media = MediaFileUpload(abs_path, mimetype="video/mp4", resumable=True, chunksize=10 * 1024 * 1024)

                req = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

                response = None
                while response is None:
                    status, response = req.next_chunk()
                    if status:
                        pct = int(status.progress() * 100)
                        _upload_progress[key].update(
                            progress=pct,
                            message=f"Uploading... {pct}%",
                        )

                video_id = response.get("id", "")
                video_url = f"https://www.youtube.com/watch?v={video_id}"
                _upload_progress[key].update(
                    progress=90,
                    stage="thumbnail",
                    message="Uploading thumbnail...",
                    video_id=video_id,
                    video_url=video_url,
                )

                # Upload thumbnail if available with auto JPEG conversion & retry loop
                if thumbnail_path and Path(thumbnail_path).exists():
                    thumb_p = Path(thumbnail_path).resolve()
                    upload_thumb_path = thumb_p

                    # Convert image to standard JPEG (1280x720) under 2MB for max YouTube compatibility
                    try:
                        from PIL import Image
                        with Image.open(thumb_p) as img:
                            img = img.convert("RGB")
                            if img.width > 1280 or img.height > 720:
                                img.thumbnail((1280, 720), Image.Resampling.LANCZOS)
                            converted_path = thumb_p.parent / f"yt_{thumb_p.stem}.jpg"
                            img.save(converted_path, "JPEG", quality=90)
                            upload_thumb_path = converted_path
                    except Exception as prep_err:
                        logger.warning(f"Thumbnail prep note: {prep_err}")

                    upload_mimetype = (
                        "image/jpeg"
                        if str(upload_thumb_path).lower().endswith((".jpg", ".jpeg"))
                        else "image/png"
                    )

                    # Retry loop (5 attempts) allowing YouTube server to register video_id
                    thumb_uploaded = False
                    last_thumb_err = ""
                    for attempt in range(1, 6):
                        wait_sec = attempt * 2.5
                        time.sleep(wait_sec)
                        try:
                            youtube.thumbnails().set(
                                videoId=video_id,
                                media_body=MediaFileUpload(str(upload_thumb_path), mimetype=upload_mimetype),
                            ).execute()
                            logger.info(f"Successfully uploaded thumbnail for video {video_id} on attempt {attempt}")
                            thumb_uploaded = True
                            break
                        except Exception as e:
                            last_thumb_err = str(e)
                            logger.warning(f"Thumbnail upload attempt {attempt} failed for video {video_id}: {e}")
                            if "customThumbnailsNotAllowed" in last_thumb_err or "403" in last_thumb_err:
                                logger.error("YouTube channel is not verified for custom thumbnails. Verify at youtube.com/verify")
                                break  # Stop retrying if channel is not enabled for custom thumbnails

                    if not thumb_uploaded:
                        logger.error(f"Failed to upload thumbnail for video {video_id}: {last_thumb_err}")

                # Auto-upload SRT captions track if available for project
                try:
                    from app.database import SessionLocal
                    from app.models import Project
                    from app.services.video import video_service

                    db = SessionLocal()
                    try:
                        project = db.query(Project).filter(Project.slug == project_slug).first()
                        if project:
                            subtitle_entries = video_service.get_subtitle_entries(project.id, db)
                            if subtitle_entries:
                                srt_text = video_service.generate_srt_content(subtitle_entries)
                                branding_dir = storage_service.get_project_path(project_slug) / "branding"
                                branding_dir.mkdir(parents=True, exist_ok=True)
                                srt_path = branding_dir / "captions.srt"
                                srt_path.write_text(srt_text, encoding="utf-8")

                                _upload_progress[key].update(
                                    progress=95,
                                    stage="captions",
                                    message="Uploading YouTube closed captions...",
                                )
                                caption_body = {
                                    "snippet": {
                                        "videoId": video_id,
                                        "language": project.language or "en",
                                        "name": "English Subtitles",
                                        "isDraft": False,
                                    }
                                }
                                youtube.captions().insert(
                                    part="snippet",
                                    body=caption_body,
                                    media_body=MediaFileUpload(str(srt_path.resolve()), mimetype="application/x-subrip", resumable=True),
                                ).execute()
                                logger.info("Auto-uploaded SRT captions to YouTube video %s", video_id)
                    finally:
                        db.close()
                except Exception as caption_err:
                    logger.warning("Failed to auto-upload SRT captions to YouTube: %s", caption_err)

                _upload_progress[key].update(
                    progress=100,
                    stage="done",
                    message="Upload complete!",
                )

            except Exception as exc:
                logger.exception("YouTube upload failed")
                _upload_progress[key].update(
                    running=False,
                    stage="failed",
                    message=f"Upload failed: {exc}",
                    error=str(exc),
                )
                return

            _upload_progress[key]["running"] = False

        thread = threading.Thread(target=_do_upload, daemon=True)
        thread.start()

    def get_upload_progress(self, project_slug: str) -> dict[str, Any]:
        return _upload_progress.get(project_slug, {
            "running": False,
            "progress": 0,
            "stage": "idle",
            "message": "",
            "video_id": None,
            "video_url": None,
            "error": None,
        })


youtube_service = YouTubeService()
