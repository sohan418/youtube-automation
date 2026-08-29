import shutil

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectStatus, SEOMetadata, Scene, SceneImage, Thumbnail
from app.routers.seo import YOUTUBE_CATEGORIES
from app.schemas import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.storage import storage_service

router = APIRouter(prefix="/projects", tags=["Projects"])


def _project_thumbnail(db: Session, project_id: int) -> str | None:
    thumb = (
        db.query(Thumbnail)
        .filter(Thumbnail.project_id == project_id)
        .order_by(Thumbnail.is_selected.desc(), Thumbnail.id.desc())
        .first()
    )
    if thumb:
        return thumb.file_path
    img = (
        db.query(SceneImage)
        .join(Scene, SceneImage.scene_id == Scene.id)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order_index.asc(), SceneImage.position.asc())
        .first()
    )
    if img:
        return img.file_path
    return None


def _serialize_project(db: Session, project: Project) -> ProjectResponse:
    return ProjectResponse(
        name=project.name,
        description=project.description,
        category=project.category,
        language=project.language,
        id=project.id,
        slug=project.slug,
        status=project.status,
        folder_path=project.folder_path,
        ratio=project.ratio or "16:9",
        thumbnail=_project_thumbnail(db, project.id),
        captions_enabled=project.captions_enabled,
        caption_style=project.caption_style,
        caption_position=project.caption_position,
        caption_color=project.caption_color,
        caption_outline_color=project.caption_outline_color,
        caption_outline=project.caption_outline,
        caption_font_size=project.caption_font_size,
        logo_overlay=project.logo_overlay,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.updated_at.desc()).all()
    return [_serialize_project(db, p) for p in projects]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    slug = storage_service.slugify(payload.name)
    existing = db.query(Project).filter(Project.slug == slug).first()
    if existing:
        counter = 2
        base_slug = slug
        while existing:
            slug = f"{base_slug}-{counter}"
            existing = db.query(Project).filter(Project.slug == slug).first()
            counter += 1

    folder = storage_service.create_project_folder(slug)
    project = Project(
        name=payload.name,
        slug=slug,
        description=payload.description,
        category=payload.category,
        language=payload.language,
        ratio=payload.ratio,
        status=ProjectStatus.DRAFT,
        folder_path=str(folder.relative_to(storage_service.root.parent)),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _serialize_project(db, project)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _serialize_project(db, project)


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    old_category = project.category
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    if payload.category and payload.category != old_category:
        seo = db.query(SEOMetadata).filter(SEOMetadata.project_id == project_id).first()
        if seo:
            match = next(
                (c for c in YOUTUBE_CATEGORIES if c["name"] == payload.category), None
            )
            if match:
                seo.category = match["name"]
                seo.category_id = match["id"]

    db.commit()
    db.refresh(project)
    return _serialize_project(db, project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project_dir = storage_service.root.parent / project.folder_path
    if project_dir.exists():
        shutil.rmtree(project_dir, ignore_errors=True)

    export_dir = storage_service.exports_root / project.slug
    if export_dir.exists():
        shutil.rmtree(export_dir, ignore_errors=True)

    db.query(Thumbnail).filter(Thumbnail.project_id == project_id).delete(
        synchronize_session=False
    )
    db.delete(project)
    db.commit()
