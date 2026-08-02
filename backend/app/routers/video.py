from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectStatus, Scene
from app.schemas import MessageResponse, VideoBuildRequest

router = APIRouter(prefix="/video", tags=["Video"])


@router.post("/project/{project_id}/build", response_model=MessageResponse)
def build_video(
    project_id: int, payload: VideoBuildRequest, db: Session = Depends(get_db)
):
    from app.services.video import video_service

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

    scene_data = [
        {
            "order_index": s.order_index,
            "image_path": s.image_path,
            "audio_path": s.audio_path,
            "duration_seconds": s.duration_seconds,
        }
        for s in scenes
    ]

    video_path = video_service.build_video(
        slug=project.slug,
        scenes=scene_data,
        background_music=payload.background_music,
        resolution=payload.resolution,
    )

    project.status = ProjectStatus.VIDEO
    db.commit()

    return MessageResponse(
        message="Video built successfully",
        detail=video_path,
    )
