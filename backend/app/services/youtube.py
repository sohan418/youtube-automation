from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"


class YouTubeService:
    def __init__(self) -> None:
        self._client = httpx.Client(timeout=15)

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


youtube_service = YouTubeService()
