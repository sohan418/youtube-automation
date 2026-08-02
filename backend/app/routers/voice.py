from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectStatus, Scene
from app.schemas import SceneResponse, VoiceGenerateRequest
from app.services.voice import voice_service

router = APIRouter(prefix="/voice", tags=["Voice"])


@router.post("/generate", response_model=SceneResponse)
def generate_voice(payload: VoiceGenerateRequest, db: Session = Depends(get_db)):
    if not payload.scene_id:
        raise HTTPException(status_code=400, detail="scene_id required")

    scene = db.query(Scene).filter(Scene.id == payload.scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    audio_path, duration = voice_service.generate_scene_audio(
        slug=project.slug,
        scene_id=scene.id,
        order_index=scene.order_index,
        narration=scene.narration,
        voice=payload.voice,
    )

    scene.audio_path = audio_path
    scene.duration_seconds = duration
    project.status = ProjectStatus.AUDIO
    db.commit()
    db.refresh(scene)
    return scene


@router.post("/project/{project_id}/generate-all", response_model=list[SceneResponse])
def generate_all_voice(
    project_id: int,
    voice: str = "alloy",
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
        raise HTTPException(status_code=400, detail="No scenes found.")

    for scene in scenes:
        audio_path, duration = voice_service.generate_scene_audio(
            slug=project.slug,
            scene_id=scene.id,
            order_index=scene.order_index,
            narration=scene.narration,
            voice=voice,
        )
        scene.audio_path = audio_path
        scene.duration_seconds = duration

    project.status = ProjectStatus.AUDIO
    db.commit()
    for scene in scenes:
        db.refresh(scene)
    return scenes
