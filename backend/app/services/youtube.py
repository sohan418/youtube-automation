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

logger = logging.getLogger(__name__)

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"]
REDIRECT_URI = "http://localhost:8000/api/youtube/auth/callback"

# Upload progress tracking (same pattern as video build)
_upload_progress: dict[str, dict[str, Any]] = {}
# PKCE code verifier storage (temporary, per-instance)
_auth_code_verifier: str | None = None


class YouTubeService:
    def __init__(self) -> None:
        self._client = httpx.Client(timeout=15)

    def _get_credentials(self) -> Credentials | None:
        if not settings.youtube_client_id or not settings.youtube_client_secret:
            return None
        if not settings.youtube_access_token or not settings.youtube_refresh_token:
            return None
        expiry = None
        if settings.youtube_token_expiry:
            try:
                expiry = datetime.fromisoformat(settings.youtube_token_expiry)
                # Ensure timezone-aware (google-auth requires it)
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
                    # Re-store with timezone so it's correct next time
                    settings.update_api_key("youtube_token_expiry", expiry.isoformat())
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
        if not creds.refresh_token:
            return
        try:
            is_expired = creds.expired
        except TypeError:
            is_expired = True  # timezone mismatch = treat as expired
        if is_expired:
            self._refresh_credentials(creds)

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
            return {
                "channel_id": ch.get("id", ""),
                "title": snippet.get("title", ""),
                "description": snippet.get("description", ""),
                "avatar": snippet.get("thumbnails", {}).get("default", {}).get("url", ""),
                "subscribers": stats.get("subscriberCount", "0"),
                "videos": stats.get("videoCount", "0"),
            }
        except Exception:
            logger.exception("Failed to get YouTube channel info")
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
        except Exception:
            logger.exception("Failed to fetch YouTube playlist items")
            return []
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

                # Upload thumbnail if available
                if thumbnail_path and Path(thumbnail_path).exists():
                    suffix = Path(thumbnail_path).suffix.lower()
                    mime = {
                        ".png": "image/png",
                        ".webp": "image/webp",
                        ".gif": "image/gif",
                        ".bmp": "image/bmp",
                    }.get(suffix, "image/jpeg")
                    try:
                        youtube.thumbnails().set(
                            videoId=video_id,
                            media_body=MediaFileUpload(str(Path(thumbnail_path).resolve()), mimetype=mime),
                        ).execute()
                    except Exception:
                        logger.warning("Failed to upload thumbnail, continuing...")

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
