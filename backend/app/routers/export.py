from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectStatus, Scene, SEOMetadata
from app.schemas import ExportResponse
from app.services.export import export_service

router = APIRouter(prefix="/export", tags=["Export"])


@router.post("/project/{project_id}", response_model=ExportResponse)
def export_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    seo = db.query(SEOMetadata).filter(SEOMetadata.project_id == project_id).first()
    seo_data = None
    if seo:
        seo_data = {
            "title": seo.title,
            "description": seo.description,
            "tags": seo.tags,
            "hashtags": seo.hashtags,
            "category": seo.category,
            "category_id": seo.category_id,
        }

    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    scene_data = [
        {
            "order_index": s.order_index,
            "narration": s.narration,
            "duration_seconds": s.duration_seconds,
        }
        for s in scenes
    ]

    export_path, files = export_service.export_project(
        project.slug, seo_data=seo_data, scenes=scene_data
    )

    project.status = ProjectStatus.EXPORTED
    db.commit()

    return ExportResponse(
        export_path=export_path,
        files=files,
        message=f"Project exported to {export_path}",
    )
