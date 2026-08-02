from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectStatus, Script, Thumbnail
from app.schemas import ThumbnailGenerateRequest, ThumbnailResponse
from app.services.ai import ai_service
from app.services.image import image_service

router = APIRouter(prefix="/thumbnails", tags=["Thumbnails"])


@router.get("/project/{project_id}", response_model=list[ThumbnailResponse])
def list_thumbnails(project_id: int, db: Session = Depends(get_db)):
    return db.query(Thumbnail).filter(Thumbnail.project_id == project_id).all()


@router.post("/project/{project_id}/generate", response_model=list[ThumbnailResponse])
def generate_thumbnails(
    project_id: int, payload: ThumbnailGenerateRequest, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    script = (
        db.query(Script)
        .filter(Script.project_id == project_id, Script.is_active.is_(True))
        .first()
    )
    title = script.title if script else project.name

    thumbnails: list[Thumbnail] = []
    for i in range(payload.count):
        prompt = ai_service.generate_thumbnail_prompt(title, payload.style)
        file_path = image_service.generate_thumbnail(project.slug, i + 1, prompt)
        thumb = Thumbnail(
            project_id=project_id,
            file_path=file_path,
            prompt=prompt,
            is_selected=i == 0,
        )
        db.add(thumb)
        thumbnails.append(thumb)

    project.status = ProjectStatus.THUMBNAIL
    db.commit()
    for thumb in thumbnails:
        db.refresh(thumb)
    return thumbnails


@router.post("/{thumbnail_id}/select", response_model=ThumbnailResponse)
def select_thumbnail(thumbnail_id: int, db: Session = Depends(get_db)):
    thumb = db.query(Thumbnail).filter(Thumbnail.id == thumbnail_id).first()
    if not thumb:
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    db.query(Thumbnail).filter(
        Thumbnail.project_id == thumb.project_id, Thumbnail.id != thumbnail_id
    ).update({"is_selected": False})

    thumb.is_selected = True
    db.commit()
    db.refresh(thumb)
    return thumb
