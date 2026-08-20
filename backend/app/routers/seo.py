from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectStatus, Scene, Script, SEOMetadata
from app.schemas import SEOCategory, SEOCategoryUpdate, SEOGenerateRequest, SEOResponse, SEOUpdate
from app.services.ai import ai_service
from app.services.storage import storage_service

router = APIRouter(prefix="/seo", tags=["SEO"])

# ---------------------------------------------------------------------------
# Marker constants — served to the frontend via GET /seo/constants so the
# frontend never needs to duplicate them.
# ---------------------------------------------------------------------------
SECTION_SEP = "─────────────────────────────"
DISCLAIMER_MARKER = "⚠️ DISCLAIMER"
TIMESTAMPS_MARKER = "⏱️ TIMESTAMPS"

DEFAULT_DISCLAIMER = (
    "This video is for educational and informational purposes only. "
    "All content is AI-generated and intended for general audiences. "
    "Views expressed do not constitute professional advice. "
    "Music and media used are either original, royalty-free, or used under "
    "fair use. No copyright infringement is intended. "
    "If you have any concerns, please contact us before filing a claim."
)

# Full block appended to every generated description
YOUTUBE_DISCLAIMER = (
    f"\n\n{SECTION_SEP}\n"
    f"{DISCLAIMER_MARKER}\n"
    f"{DEFAULT_DISCLAIMER}\n"
    f"{SECTION_SEP}"
)


def _format_timestamp(seconds: float) -> str:
    """Convert seconds to MM:SS or HH:MM:SS string."""
    total = int(seconds)
    h = total // 3600
    m = (total % 3600) // 60
    s = total % 60
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _build_timestamps(scenes: list) -> str:
    """Build a timestamps block from a list of Scene ORM objects."""
    if not scenes:
        return ""
    lines = [TIMESTAMPS_MARKER]
    current = 0.0
    for scene in sorted(scenes, key=lambda sc: sc.order_index):
        ts = _format_timestamp(current)
        narration = (scene.narration or "").strip()
        label = narration.split("\n")[0][:60] if narration else f"Scene {scene.order_index}"
        lines.append(f"{ts} – {label}")
        current += scene.duration_seconds or 5.0
    return "\n".join(lines)

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


@router.get("/constants")
def get_seo_constants():
    """Return the marker strings and default disclaimer used when building
    SEO descriptions so the frontend never needs to hard-code them."""
    return {
        "disclaimer_marker": DISCLAIMER_MARKER,
        "timestamps_marker": TIMESTAMPS_MARKER,
        "section_sep": SECTION_SEP,
        "default_disclaimer": DEFAULT_DISCLAIMER,
    }


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


@router.patch("/project/{project_id}", response_model=SEOResponse)
def update_seo(
    project_id: int, payload: SEOUpdate, db: Session = Depends(get_db)
):
    seo = db.query(SEOMetadata).filter(SEOMetadata.project_id == project_id).first()
    if not seo:
        raise HTTPException(status_code=404, detail="SEO metadata not found")

    if payload.title is not None:
        seo.title = payload.title
    if payload.description is not None:
        seo.description = payload.description
    if payload.tags is not None:
        seo.tags = payload.tags
    if payload.hashtags is not None:
        seo.hashtags = payload.hashtags

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

    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order_index)
        .all()
    )

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

    # Build description with timestamps + disclaimer appended
    base_description = raw.get("description") or ""
    timestamps_block = _build_timestamps(scenes)
    full_description = base_description
    if timestamps_block:
        full_description += f"\n\n{timestamps_block}"
    full_description += YOUTUBE_DISCLAIMER

    seo.description = full_description
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
