import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project
from app.services.storage import storage_service

router = APIRouter(prefix="/media", tags=["Media"])

ALLOWED_ROOTS = (
    storage_service.root,
    storage_service.exports_root,
    storage_service.assets_root,
    storage_service.templates_root,
)

VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}
AUDIO_EXTS = {".mp3", ".wav", ".aac", ".ogg", ".m4a", ".flac"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


@router.get("/{path:path}")
def serve_media(path: str):
    workspace = storage_service.root.parent.resolve()
    file_path = (workspace / path).resolve()

    if not any(str(file_path).startswith(str(root.resolve())) for root in ALLOWED_ROOTS):
        raise HTTPException(status_code=404, detail="Not found")
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(file_path, headers={"Cache-Control": "no-store"})


@router.post("/upload/{project_id}")
async def upload_timeline_media(
    project_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    ext = f".{ext}" if ext else ""
    if ext in VIDEO_EXTS:
        kind = "video"
    elif ext in AUDIO_EXTS:
        kind = "audio"
    elif ext in IMAGE_EXTS:
        kind = "image"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Drop a video, audio or image file.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    stem = re.sub(r"[^\w.-]", "_", (file.filename or "media").rsplit(".", 1)[0]).strip("_") or "media"
    filename = f"drop_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{stem}{ext}"
    rel_path = storage_service.save_binary(project.slug, "timeline", filename, data)

    duration: float | None = None
    width = None
    height = None
    abs_path = storage_service.root.parent / rel_path
    try:
        from app.services.video import video_service

        if kind == "video":
            info = video_service._probe_video_info(abs_path)
            if info:
                duration = info.get("duration")
                width = info.get("width")
                height = info.get("height")
        elif kind == "audio":
            duration = video_service._probe_audio_duration(abs_path)
    except Exception:
        duration = None

    return {
        "file_path": rel_path,
        "kind": kind,
        "duration_seconds": duration,
        "width": width,
        "height": height,
        "size_bytes": len(data),
    }
