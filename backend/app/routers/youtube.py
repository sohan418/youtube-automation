from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.services.youtube import youtube_service

router = APIRouter(prefix="/youtube", tags=["YouTube"])


class YouTubeConfigUpdate(BaseModel):
    youtube_api_key: str | None = None
    youtube_playlist_id: str | None = None


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
    }


@router.post("/config")
def update_youtube_config(payload: YouTubeConfigUpdate):
    if payload.youtube_api_key is not None:
        settings.update_api_key("youtube_api_key", payload.youtube_api_key)
    if payload.youtube_playlist_id is not None:
        settings.update_api_key("youtube_playlist_id", payload.youtube_playlist_id)
    return get_youtube_config()


@router.get("/recent", response_model=list[YouTubeVideoResponse])
def get_recent_videos(max_results: int = 10):
    return youtube_service.fetch_recent_videos(max_results=max_results)
