import logging
import re
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectStatus, Scene, SceneImage, SceneVideo
from app.schemas import ImageCopyRequest, ImageGenerateRequest, ImageLinkRequest, ImageReorderRequest, SceneResponse
from app.services.ai import ai_service
from app.services.image import image_service
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/images", tags=["Images"])


class ImagePromptRequest(BaseModel):
    scene_narration: str
    style: str | None = None
    ratio: str | None = None


ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif", "bmp"}

MIN_ITEM_SECONDS = 0.5


def _max_fit_items(scene: Scene) -> int:
    if not scene.duration_seconds or scene.duration_seconds <= 0:
        return 1000
    return max(1, int(scene.duration_seconds / MIN_ITEM_SECONDS))


def _extension_from_filename(filename: str) -> str | None:
    ext = (filename or "").rsplit(".", 1)[-1].lower()
    return ext if ext in ALLOWED_EXTENSIONS else None


def _extension_from_url(url: str, content_type: str) -> str:
    path = urlparse(url).path
    ext = path.rsplit(".", 1)[-1].lower() if "." in path.rsplit("/", 1)[-1] else ""
    if ext in ALLOWED_EXTENSIONS:
        return ext
    if content_type == "image/png":
        return "png"
    if content_type == "image/gif":
        return "gif"
    if content_type in ("image/webp", "image/webp;"):
        return "webp"
    if content_type == "image/bmp":
        return "bmp"
    return "jpg"


def _add_image(
    db: Session,
    scene: Scene,
    file_path: str,
    source: str,
) -> SceneImage:
    existing = (
        db.query(SceneImage)
        .filter(SceneImage.scene_id == scene.id, SceneImage.file_path == file_path)
        .first()
    )
    if existing:
        if not scene.image_path:
            scene.image_path = file_path
        return existing
    max_items = _max_fit_items(scene)
    current = (
        db.query(SceneImage).filter(SceneImage.scene_id == scene.id).count()
        + db.query(SceneVideo).filter(SceneVideo.scene_id == scene.id).count()
    )
    if current + 1 > max_items:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Scene narration is {scene.duration_seconds:.1f}s. Each media item needs "
                f"at least {MIN_ITEM_SECONDS}s, so this scene can fit at most {max_items} "
                "images/videos. Remove an item before adding another."
            ),
        )
    count = db.query(SceneImage).filter(SceneImage.scene_id == scene.id).count()
    image = SceneImage(
        scene_id=scene.id,
        file_path=file_path,
        source=source,
        position=count,
    )
    db.add(image)
    db.flush()
    if not scene.image_path:
        scene.image_path = file_path
    return image


def _ensure_project(scene: Scene, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/generate", response_model=SceneResponse)
def generate_image(payload: ImageGenerateRequest, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == payload.scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    project = _ensure_project(scene, db)

    image_path, prompt_used = image_service.generate_scene_image(
        slug=project.slug,
        scene_id=scene.id,
        order_index=scene.order_index,
        narration=scene.narration,
        style=payload.style,
        ratio=project.ratio or "16:9",
    )
    scene.image_prompt = prompt_used

    _add_image(db, scene, image_path, "generated")
    project.status = ProjectStatus.IMAGES
    db.commit()
    db.refresh(scene)
    return scene


@router.post("/project/{project_id}/generate-all", response_model=list[SceneResponse])
def generate_all_images(
    project_id: int,
    style: str | None = None,
    db: Session = Depends(get_db),
):
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
        raise HTTPException(status_code=400, detail="No scenes found. Generate scenes first.")

    for scene in scenes:
        image_path, prompt_used = image_service.generate_scene_image(
            slug=project.slug,
            scene_id=scene.id,
            order_index=scene.order_index,
            narration=scene.narration,
            style=style,
            ratio=project.ratio or "16:9",
        )
        _add_image(db, scene, image_path, "generated")
        scene.image_path = image_path
        scene.image_prompt = prompt_used

    project.status = ProjectStatus.IMAGES
    db.commit()
    for scene in scenes:
        db.refresh(scene)
    return scenes


@router.post("/scene/{scene_id}/upload", response_model=SceneResponse)
def upload_scene_image(
    scene_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    project = _ensure_project(scene, db)

    ext = _extension_from_filename(file.filename or "")
    if not ext:
        raise HTTPException(status_code=400, detail="Unsupported image type. Use PNG/JPG/WebP/GIF/BMP.")

    data = file.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    count = db.query(SceneImage).filter(SceneImage.scene_id == scene.id).count()
    filename = f"scene_{scene.order_index:03d}_upload_{count + 1}.{ext}"
    file_path = storage_service.save_binary(project.slug, "images", filename, data)

    _add_image(db, scene, file_path, "upload")
    project.status = ProjectStatus.IMAGES
    db.commit()
    db.refresh(scene)
    return scene


@router.post("/scene/{scene_id}/link", response_model=SceneResponse)
def add_scene_image_link(payload: ImageLinkRequest, scene_id: int, db: Session = Depends(get_db)):
    url = (payload.url or "").strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Please enter a valid image URL (http/https).")

    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    project = _ensure_project(scene, db)

    try:
        response = httpx.get(url, timeout=20, follow_redirects=True)
        response.raise_for_status()
    except Exception as exc:
        logger.warning("Could not download linked image (%s): %s", url, exc)
        raise HTTPException(
            status_code=400,
            detail=f"Could not download image from URL: {url}",
        ) from exc

    content_type = response.headers.get("content-type", "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"URL does not point to an image (content-type: {content_type or 'unknown'})",
        )
    if not response.content:
        raise HTTPException(status_code=400, detail="Downloaded image is empty")

    ext = _extension_from_url(url, content_type)
    count = db.query(SceneImage).filter(SceneImage.scene_id == scene.id).count()
    filename = f"scene_{scene.order_index:03d}_link_{count + 1}.{ext}"
    file_path = storage_service.save_binary(
        project.slug, "images", filename, response.content
    )

    _add_image(db, scene, file_path, "link")
    project.status = ProjectStatus.IMAGES
    db.commit()
    db.refresh(scene)
    return scene


@router.post("/{image_id}/set-primary", response_model=SceneResponse)
def set_primary_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(SceneImage).filter(SceneImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    scene = db.query(Scene).filter(Scene.id == image.scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    scene.image_path = image.file_path
    db.commit()
    db.refresh(scene)
    return scene


@router.delete("/{image_id}", response_model=SceneResponse)
def delete_scene_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(SceneImage).filter(SceneImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    scene = db.query(Scene).filter(Scene.id == image.scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    removed = False
    try:
        path = storage_service.root.parent / image.file_path
        if path.exists():
            path.unlink()
            removed = True
    except OSError:
        pass

    db.delete(image)
    db.flush()

    if scene.image_path == image.file_path:
        remaining = (
            db.query(SceneImage)
            .filter(SceneImage.scene_id == scene.id)
            .order_by(SceneImage.position)
            .all()
        )
        scene.image_path = remaining[0].file_path if remaining else None

    if removed:
        logger.info("Removed image file %s", image.file_path)

    db.commit()
    db.refresh(scene)
    return scene


@router.post("/scene/{scene_id}/reorder", response_model=SceneResponse)
def reorder_scene_images(
    scene_id: int,
    payload: ImageReorderRequest,
    db: Session = Depends(get_db),
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    images = {
        img.id: img
        for img in db.query(SceneImage).filter(SceneImage.scene_id == scene_id).all()
    }

    if set(payload.image_ids) != set(images.keys()):
        raise HTTPException(
            status_code=400,
            detail="image_ids must contain exactly the scene's current images",
        )

    for position, image_id in enumerate(payload.image_ids):
        images[image_id].position = position

    db.commit()
    db.refresh(scene)
    return scene


@router.post("/{image_id}/copy", response_model=SceneResponse)
def copy_scene_image(
    image_id: int,
    payload: ImageCopyRequest,
    db: Session = Depends(get_db),
):
    image = db.query(SceneImage).filter(SceneImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    target = db.query(Scene).filter(Scene.id == payload.scene_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target scene not found")

    source = db.query(Scene).filter(Scene.id == image.scene_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source scene not found")

    project = db.query(Project).filter(Project.id == target.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    copied_path = image.file_path
    if image.source != "link":
        try:
            src_path = storage_service.root.parent / image.file_path
            if src_path.exists():
                ext = src_path.suffix.lstrip(".") or "png"
                count = (
                    db.query(SceneImage)
                    .filter(SceneImage.scene_id == target.id)
                    .count()
                )
                filename = f"scene_{target.order_index:03d}_copy_{count + 1}.{ext}"
                copied_path = storage_service.save_binary(
                    project.slug, "images", filename, src_path.read_bytes()
                )
        except OSError as exc:
            logger.warning("Could not copy image file, sharing path instead: %s", exc)

    _add_image(db, target, copied_path, "copy")
    project.status = ProjectStatus.IMAGES
    db.commit()
    db.refresh(target)
    return target


@router.post("/prompt")
def build_image_prompt(payload: ImagePromptRequest, db: Session = Depends(get_db)):
    """Return the exact prompt that would be sent to the LLM for image prompt generation."""
    return ai_service.build_image_prompt(
        scene_narration=payload.scene_narration,
        style=payload.style,
        ratio=payload.ratio or "16:9",
    )
