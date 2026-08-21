import logging
import subprocess
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Project, ProjectStatus, Scene, SceneImage, SceneVideo
from app.schemas import SceneMediaReorderRequest, SceneResponse
from app.services.storage import storage_service
from app.services.video import video_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scenes", tags=["Scene Videos"])

ALLOWED_EXTENSIONS = {"mp4", "mov", "m4v", "webm", "mkv", "avi"}

MIN_ITEM_SECONDS = 0.5
DURATION_TOLERANCE = 0.3


def _auto_crop_video(file_path: str, max_duration: float) -> str:
    """Trim video to max_duration using ffmpeg. Returns the same or new path."""
    full_path = storage_service.root.parent / file_path
    info = video_service._probe_video_info(full_path)
    clip_duration = (info or {}).get("duration")
    if not clip_duration or clip_duration <= max_duration + DURATION_TOLERANCE:
        return file_path

    cropped_path = full_path.with_name(full_path.stem + "_cropped" + full_path.suffix)
    try:
        cmd = [
            settings.ffmpeg_path, "-y",
            "-i", str(full_path),
            "-t", str(round(max_duration, 3)),
            "-c", "copy",
            "-avoid_negative_ts", "make_zero",
            str(cropped_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0 and cropped_path.exists() and cropped_path.stat().st_size > 0:
            full_path.unlink(missing_ok=True)
            cropped_path.rename(full_path)
            logger.info("Auto-cropped %s to %.1fs", file_path, max_duration)
        else:
            logger.warning("Auto-crop failed, keeping original: %s", result.stderr[:200])
            cropped_path.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning("Auto-crop error, keeping original: %s", exc)
        cropped_path.unlink(missing_ok=True)
    return file_path


def _max_fit_items(scene: Scene) -> int:
    if not scene.duration_seconds or scene.duration_seconds <= 0:
        return 1000
    return max(1, int(scene.duration_seconds / MIN_ITEM_SECONDS))


def _scene_media_count(db: Session, scene_id: int) -> int:
    return (
        db.query(SceneImage).filter(SceneImage.scene_id == scene_id).count()
        + db.query(SceneVideo).filter(SceneVideo.scene_id == scene_id).count()
    )


def _cleanup_saved_file(file_path: str) -> None:
    try:
        path = storage_service.root.parent / file_path
        if path.exists():
            path.unlink()
    except OSError:
        pass


def _delete_scene_video_files(db: Session, scene_id: int) -> None:
    videos = (
        db.query(SceneVideo)
        .filter(SceneVideo.scene_id == scene_id)
        .order_by(SceneVideo.position)
        .all()
    )
    for video in videos:
        try:
            path = storage_service.root.parent / video.file_path
            if path.exists():
                path.unlink()
        except OSError:
            pass
        db.delete(video)


@router.post("/{scene_id}/video/upload", response_model=SceneResponse)
def upload_scene_video(
    scene_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type. Use {', '.join(sorted(ALLOWED_EXTENSIONS))}.",
        )

    data = file.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    count = db.query(SceneVideo).filter(SceneVideo.scene_id == scene.id).count()
    max_items = _max_fit_items(scene)
    if _scene_media_count(db, scene.id) + 1 > max_items:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Scene narration is {scene.duration_seconds:.1f}s. Each media item needs "
                f"at least {MIN_ITEM_SECONDS}s, so this scene can fit at most {max_items} "
                "images/videos. Remove an item before adding another."
            ),
        )

    filename = f"scene_{scene.order_index:03d}_clip_{count + 1}.{ext}"
    file_path = storage_service.save_binary(project.slug, "clips", filename, data)

    info = video_service._probe_video_info(storage_service.root.parent / file_path)
    clip_duration = (info or {}).get("duration")
    if (
        clip_duration
        and scene.duration_seconds
        and clip_duration > scene.duration_seconds + DURATION_TOLERANCE
    ):
        file_path = _auto_crop_video(file_path, scene.duration_seconds)

    video = SceneVideo(
        scene_id=scene.id,
        file_path=file_path,
        source="upload",
        position=count,
    )
    db.add(video)
    project.status = ProjectStatus.IMAGES
    db.commit()
    db.refresh(scene)
    return scene


@router.post("/{scene_id}/media/reorder", response_model=SceneResponse)
def reorder_scene_media(
    scene_id: int,
    payload: SceneMediaReorderRequest,
    db: Session = Depends(get_db),
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    images = {
        img.id: img
        for img in db.query(SceneImage).filter(SceneImage.scene_id == scene_id).all()
    }
    videos = {
        vid.id: vid
        for vid in db.query(SceneVideo).filter(SceneVideo.scene_id == scene_id).all()
    }

    expected = len(images) + len(videos)
    if len(payload.items) != expected:
        raise HTTPException(
            status_code=400,
            detail=f"items must contain exactly the scene's current media ({expected} items)",
        )

    seen: set[tuple[str, int]] = set()
    for position, item in enumerate(payload.items):
        key = (item.type, item.id)
        if key in seen:
            raise HTTPException(status_code=400, detail=f"Duplicate media item {key}")
        seen.add(key)
        if item.type == "image":
            if item.id not in images:
                raise HTTPException(status_code=400, detail=f"Image {item.id} not in scene")
            images[item.id].position = position
        else:
            if item.id not in videos:
                raise HTTPException(status_code=400, detail=f"Video {item.id} not in scene")
            videos[item.id].position = position

    db.commit()
    db.refresh(scene)
    return scene


@router.delete("/{scene_id}/video/{video_id}", response_model=SceneResponse)
def delete_scene_video(
    scene_id: int,
    video_id: int,
    db: Session = Depends(get_db),
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    video = (
        db.query(SceneVideo)
        .filter(SceneVideo.id == video_id, SceneVideo.scene_id == scene_id)
        .first()
    )
    if not video:
        raise HTTPException(status_code=404, detail="Video clip not found")

    try:
        path = storage_service.root.parent / video.file_path
        if path.exists():
            path.unlink()
    except OSError:
        pass

    db.delete(video)
    db.commit()
    db.refresh(scene)
    return scene
