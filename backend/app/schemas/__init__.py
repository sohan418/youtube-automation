from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import ProjectStatus


class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    category: str | None = None
    language: str = "en"


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    language: str | None = None
    status: ProjectStatus | None = None
    ratio: str | None = None
    captions_enabled: bool | None = None
    caption_style: str | None = None
    caption_position: str | None = None
    caption_color: str | None = None
    caption_outline_color: str | None = None
    caption_outline: float | None = None
    caption_font_size: int | None = None


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    status: ProjectStatus
    folder_path: str
    ratio: str = "16:9"
    thumbnail: str | None = None
    captions_enabled: bool = False
    caption_style: str = "shorts"
    caption_position: str = "bottom"
    caption_color: str = "#FFFF00"
    caption_outline_color: str = "#000000"
    caption_outline: float = 2.0
    caption_font_size: int | None = None
    created_at: datetime
    updated_at: datetime


class IdeaBase(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None


class IdeaGenerateRequest(BaseModel):
    category: str | None = None
    count: int = Field(default=5, ge=1, le=20)
    language: str | None = None
    topic: str | None = None


class IdeaResponse(IdeaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int | None
    trending_score: int
    is_selected: bool
    created_at: datetime


class ScriptGenerateRequest(BaseModel):
    idea_id: int | None = None
    topic: str | None = None
    language: str | None = None
    target_duration_minutes: int = Field(default=5, ge=1, le=30)


class ScriptCreate(BaseModel):
    title: str = Field(min_length=1)
    hook: str | None = None
    body: str = Field(min_length=1)
    ending: str | None = None
    language: str | None = None


class ScriptUpdate(BaseModel):
    title: str | None = None
    hook: str | None = None
    body: str | None = None
    ending: str | None = None


class ScriptImportRequest(BaseModel):
    title: str | None = None
    hook: str | None = None
    body: str = Field(min_length=1)
    ending: str | None = None
    language: str | None = None
    replace: bool = True


class ScriptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    hook: str | None
    body: str
    ending: str | None
    language: str
    word_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SceneGenerateRequest(BaseModel):
    script_id: int
    count: int | None = Field(default=None, ge=1, le=30)


class SceneCreate(BaseModel):
    narration: str = Field(min_length=1)
    image_prompt: str | None = None
    video_prompt: str | None = None
    motion_effect: str | None = "zoom_in"
    script_id: int | None = None
    order_index: int | None = None


class SceneImportItem(BaseModel):
    narration: str
    image_prompt: str | None = None
    video_prompt: str | None = None
    motion_effect: str | None = "zoom_in"


class SceneImportRequest(BaseModel):
    scenes: list[SceneImportItem]
    replace: bool = True


class SceneUpdate(BaseModel):
    narration: str | None = None
    image_prompt: str | None = None
    video_prompt: str | None = None
    motion_effect: str | None = None
    order_index: int | None = None


class SceneImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scene_id: int
    file_path: str
    source: str
    position: int
    created_at: datetime


class SceneVideoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scene_id: int
    file_path: str
    source: str
    position: int
    created_at: datetime


class SceneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    script_id: int
    order_index: int
    narration: str
    image_prompt: str | None
    video_prompt: str | None
    motion_effect: str | None = "zoom_in"
    image_path: str | None
    video_path: str | None
    audio_path: str | None
    duration_seconds: float | None
    images: list[SceneImageResponse] = Field(default_factory=list, validation_alias="scene_images")
    videos: list[SceneVideoResponse] = Field(default_factory=list, validation_alias="scene_videos")
    created_at: datetime
    updated_at: datetime


class ImageGenerateRequest(BaseModel):
    scene_id: int
    style: str | None = None


class ImageLinkRequest(BaseModel):
    url: str


class ImageReorderRequest(BaseModel):
    image_ids: list[int]


class SceneMediaReorderItem(BaseModel):
    type: Literal["image", "video"]
    id: int


class SceneMediaReorderRequest(BaseModel):
    items: list[SceneMediaReorderItem]


class ImageCopyRequest(BaseModel):
    scene_id: int


class VoiceGenerateRequest(BaseModel):
    scene_id: int | None = None
    voice: str | None = None
    provider: str = "gemini"
    generate_all: bool = False
    rate: str = "+0%"


class VoiceConfigUpdate(BaseModel):
    sarvam_api_key: str | None = None
    deepgram_api_key: str | None = None
    elevenlabs_api_key: str | None = None


class TimelineClip(BaseModel):
    id: str
    scene_id: int
    track: str = "video"  # "video" | "narration"
    start: float = 0.0
    duration: float = 5.0
    image_path: str | None = None
    video_path: str | None = None
    audio_path: str | None = None
    audio_in: float | None = None
    audio_out: float | None = None
    volume: float = 1.0
    motion_effect: str | None = "none"


class TimelineMusic(BaseModel):
    file_path: str | None = None
    volume: float = 0.12


class TimelineData(BaseModel):
    version: int = 1
    duration: float = 0.0
    clips: list[TimelineClip] = Field(default_factory=list)
    music: TimelineMusic | None = None


class TimelineResponse(BaseModel):
    project_id: int
    data: TimelineData
    version: int = 0
    updated_at: datetime | None = None


class VideoBuildRequest(BaseModel):
    background_music: str | None = None
    music_volume: float = Field(default=0.12, ge=0.0, le=1.0)
    resolution: str | None = None
    ratio: str = "16:9"
    subtitles: bool = False
    subtitle_style: str = "default"
    subtitle_position: str = "bottom"
    subtitle_color: str = "#FFFF00"
    subtitle_outline_color: str = "#000000"
    subtitle_outline: float = Field(default=2.0, ge=0.0, le=10.0)
    subtitle_font_size: int | None = Field(default=None, ge=8, le=200)


class MusicTrackResponse(BaseModel):
    filename: str
    name: str
    file_path: str
    duration_seconds: float | None = None
    size_bytes: int


class VideoClipResponse(BaseModel):
    filename: str
    name: str
    file_path: str
    duration_seconds: float | None = None
    width: int | None = None
    height: int | None = None
    size_bytes: int


class MusicSuggestionResponse(BaseModel):
    mood: str
    search_keywords: str
    genre_tags: list[str] = Field(default_factory=list)
    recommended_volume: float = 0.12
    explanation: str
    search_urls: dict[str, str] = Field(default_factory=dict)


class VideoStatusResponse(BaseModel):
    running: bool
    progress: int
    stage: str
    message: str
    output: str | None = None
    error: str | None = None
    updated_at: str | None = None


class ThumbnailGenerateRequest(BaseModel):
    count: int = Field(default=3, ge=1, le=10)
    style: str | None = None


class ThumbnailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    file_path: str
    prompt: str | None
    is_selected: bool
    created_at: datetime


class SEOGenerateRequest(BaseModel):
    language: str = "en"


class SEOCategory(BaseModel):
    id: int
    name: str


class SEOCategoryUpdate(BaseModel):
    category_id: int


class SEOUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    tags: str | None = None
    hashtags: str | None = None


class SEOResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str | None
    description: str | None
    tags: str | None
    hashtags: str | None
    category: str | None
    category_id: int | None
    created_at: datetime
    updated_at: datetime


class ExportResponse(BaseModel):
    export_path: str
    files: list[str]
    message: str


class MessageResponse(BaseModel):
    message: str
    detail: str | None = None
