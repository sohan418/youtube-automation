from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectStatus, Scene, Script
from app.schemas import SceneGenerateRequest, SceneResponse, SceneUpdate
from app.services.ai import ai_service

router = APIRouter(prefix="/scenes", tags=["Scenes"])


@router.get("/project/{project_id}", response_model=list[SceneResponse])
def list_scenes(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order_index)
        .all()
    )


@router.post("/project/{project_id}/generate", response_model=list[SceneResponse])
def generate_scenes(
    project_id: int, payload: SceneGenerateRequest, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    script = db.query(Script).filter(Script.id == payload.script_id).first()
    if not script or script.project_id != project_id:
        raise HTTPException(status_code=404, detail="Script not found")

    db.query(Scene).filter(Scene.script_id == script.id).delete()

    raw_scenes = ai_service.generate_scenes(
        script.body,
        script.hook or "",
        script.ending or "",
        language=project.language,
    )

    scenes: list[Scene] = []
    for i, raw in enumerate(raw_scenes):
        scene = Scene(
            project_id=project_id,
            script_id=script.id,
            order_index=i + 1,
            narration=raw.get("narration", ""),
            image_prompt=raw.get("image_prompt"),
        )
        db.add(scene)
        scenes.append(scene)

    project.status = ProjectStatus.SCENES
    db.commit()
    for scene in scenes:
        db.refresh(scene)
    return scenes


@router.patch("/{scene_id}", response_model=SceneResponse)
def update_scene(scene_id: int, payload: SceneUpdate, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(scene, field, value)

    db.commit()
    db.refresh(scene)
    return scene
