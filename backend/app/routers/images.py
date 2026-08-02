from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectStatus, Scene
from app.schemas import ImageGenerateRequest, SceneResponse
from app.services.image import image_service

router = APIRouter(prefix="/images", tags=["Images"])


@router.post("/generate", response_model=SceneResponse)
def generate_image(payload: ImageGenerateRequest, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == payload.scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    image_path = image_service.generate_scene_image(
        slug=project.slug,
        scene_id=scene.id,
        order_index=scene.order_index,
        narration=scene.narration,
        image_prompt=scene.image_prompt,
        style=payload.style,
    )

    scene.image_path = image_path
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
        image_path = image_service.generate_scene_image(
            slug=project.slug,
            scene_id=scene.id,
            order_index=scene.order_index,
            narration=scene.narration,
            image_prompt=scene.image_prompt,
            style=style,
        )
        scene.image_path = image_path

    project.status = ProjectStatus.IMAGES
    db.commit()
    for scene in scenes:
        db.refresh(scene)
    return scenes
