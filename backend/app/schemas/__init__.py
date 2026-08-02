from datetime import datetime

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


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    status: ProjectStatus
    folder_path: str
    created_at: datetime
    updated_at: datetime


class IdeaBase(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None


class IdeaGenerateRequest(BaseModel):
    category: str | None = None
    count: int = Field(default=5, ge=1, le=20)
    language: str = "en"


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
    language: str = "en"
    target_duration_minutes: int = Field(default=5, ge=1, le=30)


class ScriptUpdate(BaseModel):
    title: str | None = None
    hook: str | None = None
    body: str | None = None
    ending: str | None = None


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


class SceneUpdate(BaseModel):
    narration: str | None = None
    image_prompt: str | None = None
    order_index: int | None = None


class SceneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    script_id: int
    order_index: int
    narration: str
    image_prompt: str | None
    image_path: str | None
    audio_path: str | None
    duration_seconds: float | None
    created_at: datetime
    updated_at: datetime


class ImageGenerateRequest(BaseModel):
    scene_id: int
    style: str | None = None


class VoiceGenerateRequest(BaseModel):
    scene_id: int | None = None
    voice: str = "alloy"
    generate_all: bool = False


class VideoBuildRequest(BaseModel):
    background_music: str | None = None
    resolution: str = "1920x1080"


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
