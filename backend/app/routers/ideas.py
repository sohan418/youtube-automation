from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Idea, Project, ProjectStatus
from app.schemas import IdeaGenerateRequest, IdeaResponse
from app.services.ai import ai_service
from app.services.youtube import youtube_service

router = APIRouter(prefix="/ideas", tags=["Ideas"])


class IdeaRecentVideo(BaseModel):
    title: str
    description: str | None = None


class IdeaPromptRequest(BaseModel):
    category: str | None = None
    count: int = 5
    language: str = "en"
    topic: str | None = None
    recent_videos: list[IdeaRecentVideo] | None = None


class IdeaImportItem(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    trending_score: int | None = None


class IdeaImportRequest(BaseModel):
    ideas: list[IdeaImportItem]


@router.post("/project/{project_id}/import", response_model=list[IdeaResponse])
def import_ideas(project_id: int, payload: IdeaImportRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ideas: list[Idea] = []
    for item in payload.ideas:
        idea = Idea(
            project_id=project_id,
            title=item.title,
            description=item.description,
            category=item.category,
            trending_score=item.trending_score if item.trending_score is not None else 50,
        )
        db.add(idea)
        ideas.append(idea)

    project.status = ProjectStatus.IDEA
    db.commit()
    for idea in ideas:
        db.refresh(idea)
    return ideas


@router.get("/project/{project_id}", response_model=list[IdeaResponse])
def list_project_ideas(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Idea)
        .filter(Idea.project_id == project_id)
        .order_by(Idea.created_at.desc(), Idea.id.desc())
        .all()
    )


@router.post("/project/{project_id}/generate", response_model=list[IdeaResponse])
def generate_ideas(
    project_id: int, payload: IdeaGenerateRequest, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        recent_videos = youtube_service.fetch_recent_videos()
        raw_ideas = ai_service.generate_ideas(
            category=payload.category or project.category,
            count=payload.count,
            language=payload.language or project.language,
            topic=payload.topic,
            recent_videos=recent_videos or None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=502, detail=f"AI idea generation failed: {exc}"
        ) from exc

    ideas: list[Idea] = []
    for raw in raw_ideas:
        idea = Idea(
            project_id=project_id,
            title=raw.get("title", "Untitled Idea"),
            description=raw.get("description"),
            category=raw.get("category", payload.category),
            trending_score=raw.get("trending_score", 50),
        )
        db.add(idea)
        ideas.append(idea)

    project.status = ProjectStatus.IDEA
    db.commit()
    for idea in ideas:
        db.refresh(idea)
    return ideas


@router.post("/project/{project_id}/prompt")
def build_idea_prompt(project_id: int, payload: IdeaPromptRequest, db: Session = Depends(get_db)):
    """Return the exact prompt that would be sent to the LLM for idea generation."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    recent_videos = None
    if payload.recent_videos:
        recent_videos = [{"title": v.title, "description": v.description or ""} for v in payload.recent_videos]
    else:
        try:
            recent_videos = youtube_service.fetch_recent_videos()
        except Exception:
            recent_videos = None

    return ai_service.build_ideas_prompt(
        category=payload.category or project.category,
        count=payload.count,
        language=payload.language or project.language,
        topic=payload.topic,
        recent_videos=recent_videos or None,
    )


@router.post("/{idea_id}/select", response_model=IdeaResponse)
def select_idea(idea_id: int, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    if idea.project_id:
        db.query(Idea).filter(
            Idea.project_id == idea.project_id, Idea.id != idea_id
        ).update({"is_selected": False})

    idea.is_selected = True
    db.commit()
    db.refresh(idea)
    return idea


@router.delete("/{idea_id}")
def delete_idea(idea_id: int, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")

    db.delete(idea)
    db.commit()
    return {"message": "Idea deleted", "id": idea_id}
