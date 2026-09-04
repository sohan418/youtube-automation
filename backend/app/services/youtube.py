from __future__ import annotations

import json
import hashlib
import base64
import logging
import secrets
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

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

    def _ensure_circular_logo(self, logo_path: Path) -> None:
        """Ensure the cached logo image is circular with transparency and smooth anti-aliased edges."""
        try:
            from PIL import Image, ImageDraw
            img = Image.open(logo_path).convert("RGBA")
            
            # Create a 4x supersampled mask for smooth anti-aliasing
            scale_factor = 4
            mask_size = (img.size[0] * scale_factor, img.size[1] * scale_factor)
            mask = Image.new("L", mask_size, 0)
            draw = ImageDraw.Draw(mask)
            draw.ellipse((0, 0, mask_size[0] - 1, mask_size[1] - 1), fill=255)
            
            # Downscale mask to original size using high-quality LANCZOS resampler
            mask = mask.resize(img.size, resample=Image.Resampling.LANCZOS)
            
            circular_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
            circular_img.paste(img, (0, 0), mask=mask)
            circular_img.save(logo_path, "PNG")
        except Exception as e:
            logger.error(f"Failed to make logo circular: {e}")

    def _create_default_logo(self, logo_path: Path):
        """Generates a stylish circular default channel logo PNG if avatar download fails or offline."""
        try:
            logo_path.parent.mkdir(parents=True, exist_ok=True)
            size = (200, 200)
            img = Image.new("RGBA", size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)

            # Red circular background
            draw.ellipse((4, 4, 195, 195), fill=(225, 29, 72, 245), outline=(255, 255, 255, 230), width=5)

            # White play icon triangle
            play_points = [(82, 65), (82, 135), (135, 100)]
            draw.polygon(play_points, fill=(255, 255, 255, 255))

            img.save(logo_path, "PNG")
        except Exception as e:
            logger.error(f"Failed to create default logo: {e}")

    def get_channel_logo_path(self, project_slug: str, force_refresh: bool = False) -> Path | None:
        """Download & cache the connected channel's logo into the project folder."""
        branding_dir = storage_service.get_project_path(project_slug) / "branding"
        logo = branding_dir / "logo.png"

        if not force_refresh and logo.exists() and logo.stat().st_size > 300:
            self._ensure_circular_logo(logo)
            return logo

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

        # Fallback: Create default circular logo if avatar download fails or not connected
        if not logo.exists() or logo.stat().st_size < 100:
            self._create_default_logo(logo)

        if logo.exists():
            return logo

        return None

    def get_auth_url(self) -> str:
        global _auth_code_verifier
        # Generate PKCE code verifier and challenge
        _auth_code_verifier = secrets.token_urlsafe(64)[:128]
        digest = hashlib.sha256(_auth_code_verifier.encode("ascii")).digest()
        code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
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
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://accounts.google.com/o/oauth2/auth?{qs}"

    def handle_callback(self, code: str) -> bool:
        global _auth_code_verifier
        try:
            token_data = {
                "code": code,
                "client_id": settings.youtube_client_id,
                "client_secret": settings.youtube_client_secret,
                "redirect_uri": REDIRECT_URI,
                "grant_type": "authorization_code",
            }
            if _auth_code_verifier:
                token_data["code_verifier"] = _auth_code_verifier
                _auth_code_verifier = None
            logger.info("OAuth callback: client_id=%s..., redirect_uri=%s, has_verifier=%s", settings.youtube_client_id[:10], REDIRECT_URI, bool(token_data.get("code_verifier")))
            resp = httpx.Client(timeout=30).post(
                "https://oauth2.googleapis.com/token",
                data=token_data,
            )
            if resp.status_code != 200:
                logger.error("Token exchange failed: %s %s", resp.status_code, resp.text)
                return False
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

    def fetch_recent_videos(self, playlist_id: str | None = None, max_results: int = 10) -> list[dict[str, Any]]:
        api_key = settings.youtube_api_key
        pid = playlist_id or settings.youtube_playlist_id

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
                    if pid:
                        settings.update_api_key("youtube_playlist_id", pid)
            except Exception as ch_err:
                logger.warning("Could not auto-fetch channel uploads playlist: %s", ch_err)

        if not pid and not creds and not api_key:
            return []

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

                body = {
                    "snippet": {
                        "title": title[:100],
                        "description": description[:5000],
                        "tags": tags[:30] if tags else [],
                        "categoryId": str(category_id) if category_id else "22",
                    },
                    "status": {
                        "privacyStatus": privacy_status,
                        "selfDeclaredMadeForKids": False,
                    },
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

                    # Retry loop (3 attempts) allowing YouTube server to register video_id
                    thumb_uploaded = False
                    for attempt in range(1, 4):
                        time.sleep(2.5)
                        try:
                            youtube.thumbnails().set(
                                videoId=video_id,
                                media_body=MediaFileUpload(str(upload_thumb_path), mimetype="image/jpeg"),
                            ).execute()
                            logger.info(f"Successfully uploaded thumbnail for video {video_id} on attempt {attempt}")
                            thumb_uploaded = True
                            break
                        except Exception as e:
                            logger.warning(f"Thumbnail upload attempt {attempt} failed for video {video_id}: {e}")

                    if not thumb_uploaded:
                        logger.error(f"Failed to upload thumbnail for video {video_id} after 3 attempts.")

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
