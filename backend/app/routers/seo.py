from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectStatus, Script, SEOMetadata
from app.schemas import SEOCategory, SEOCategoryUpdate, SEOGenerateRequest, SEOResponse
from app.services.ai import ai_service
from app.services.storage import storage_service

router = APIRouter(prefix="/seo", tags=["SEO"])

YOUTUBE_CATEGORIES: list[dict[str, int | str]] = [
    {"id": 1, "name": "Film & Animation"},
    {"id": 2, "name": "Autos & Vehicles"},
    {"id": 10, "name": "Music"},
    {"id": 15, "name": "Pets & Animals"},
    {"id": 17, "name": "Sports"},
    {"id": 18, "name": "Short Movies"},
    {"id": 19, "name": "Travel & Events"},
    {"id": 20, "name": "Gaming"},
    {"id": 21, "name": "Videoblogging"},
    {"id": 22, "name": "People & Blogs"},
    {"id": 23, "name": "Comedy"},
    {"id": 24, "name": "Entertainment"},
    {"id": 25, "name": "News & Politics"},
    {"id": 26, "name": "Howto & Style"},
    {"id": 27, "name": "Education"},
    {"id": 28, "name": "Science & Technology"},
    {"id": 29, "name": "Nonprofits & Activism"},
    {"id": 30, "name": "Movies"},
    {"id": 31, "name": "Anime/Animation"},
    {"id": 32, "name": "Action/Adventure"},
    {"id": 33, "name": "Classics"},
    {"id": 34, "name": "Comedy"},
    {"id": 35, "name": "Documentary"},
    {"id": 36, "name": "Drama"},
    {"id": 37, "name": "Family"},
    {"id": 38, "name": "Foreign"},
    {"id": 39, "name": "Horror"},
    {"id": 40, "name": "Sci-Fi/Fantasy"},
    {"id": 41, "name": "Thriller"},
    {"id": 42, "name": "Shorts"},
    {"id": 43, "name": "Shows"},
    {"id": 44, "name": "Trailers"},
]


@router.get("/categories", response_model=list[SEOCategory])
def list_categories():
    return YOUTUBE_CATEGORIES


@router.get("/project/{project_id}", response_model=SEOResponse | None)
def get_seo(project_id: int, db: Session = Depends(get_db)):
    seo = db.query(SEOMetadata).filter(SEOMetadata.project_id == project_id).first()
    return seo


@router.patch("/project/{project_id}/category", response_model=SEOResponse)
def update_seo_category(
    project_id: int, payload: SEOCategoryUpdate, db: Session = Depends(get_db)
):
    seo = db.query(SEOMetadata).filter(SEOMetadata.project_id == project_id).first()
    if not seo:
        raise HTTPException(status_code=404, detail="SEO metadata not found")

    category = next(
        (c for c in YOUTUBE_CATEGORIES if c["id"] == payload.category_id), None
    )
    if not category:
        raise HTTPException(status_code=400, detail="Invalid YouTube category id")

    seo.category = category["name"]  # type: ignore[assignment]
    seo.category_id = category["id"]  # type: ignore[assignment]
    db.commit()
    db.refresh(seo)
    return seo


@router.post("/project/{project_id}/generate", response_model=SEOResponse)
def generate_seo(
    project_id: int, payload: SEOGenerateRequest, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    script = (
        db.query(Script)
        .filter(Script.project_id == project_id, Script.is_active.is_(True))
        .first()
    )
    if not script:
        raise HTTPException(status_code=400, detail="Generate a script first")

    try:
        raw = ai_service.generate_seo(
            script.title, script.body, payload.language or project.language
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=502, detail=f"AI SEO generation failed: {exc}"
        ) from exc

    seo = db.query(SEOMetadata).filter(SEOMetadata.project_id == project_id).first()
    if not seo:
        seo = SEOMetadata(project_id=project_id)
        db.add(seo)

    seo.title = raw.get("title")
    seo.description = raw.get("description")
    seo.tags = raw.get("tags")
    seo.hashtags = raw.get("hashtags")

    import json

    storage_service.save_text(
        project.slug,
        "metadata",
        "seo.json",
        json.dumps(
            {
                "title": seo.title,
                "description": seo.description,
                "tags": seo.tags,
                "hashtags": seo.hashtags,
                "category": seo.category,
                "category_id": seo.category_id,
            },
            indent=2,
            ensure_ascii=False,
        ),
    )

    project.status = ProjectStatus.SEO
    db.commit()
    db.refresh(seo)
    return seo
