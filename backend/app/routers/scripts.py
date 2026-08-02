from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Idea, Project, ProjectStatus, Script
from app.schemas import ScriptGenerateRequest, ScriptResponse, ScriptUpdate
from app.services.ai import ai_service
from app.services.storage import storage_service

router = APIRouter(prefix="/scripts", tags=["Scripts"])


@router.get("/project/{project_id}", response_model=list[ScriptResponse])
def list_scripts(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Script)
        .filter(Script.project_id == project_id)
        .order_by(Script.created_at.desc())
        .all()
    )


@router.post("/project/{project_id}/generate", response_model=ScriptResponse)
def generate_script(
    project_id: int, payload: ScriptGenerateRequest, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    topic = payload.topic
    if payload.idea_id:
        idea = db.query(Idea).filter(Idea.id == payload.idea_id).first()
        if idea:
            topic = idea.title
            idea.is_selected = True

    if not topic:
        raise HTTPException(status_code=400, detail="Provide topic or idea_id")

    language = payload.language or project.language
    raw = ai_service.generate_script(topic, language, payload.target_duration_minutes)

    body = raw.get("body", "")
    word_count = len(body.split())

    db.query(Script).filter(Script.project_id == project_id).update({"is_active": False})

    script = Script(
        project_id=project_id,
        title=raw.get("title", topic),
        hook=raw.get("hook"),
        body=body,
        ending=raw.get("ending"),
        language=language,
        word_count=word_count,
        is_active=True,
    )
    db.add(script)
    project.status = ProjectStatus.SCRIPT

    storage_service.save_text(
        project.slug,
        "script",
        "script.txt",
        f"# {script.title}\n\n## Hook\n{script.hook}\n\n## Body\n{script.body}\n\n## Ending\n{script.ending}",
    )

    db.commit()
    db.refresh(script)
    return script


@router.patch("/{script_id}", response_model=ScriptResponse)
def update_script(script_id: int, payload: ScriptUpdate, db: Session = Depends(get_db)):
    script = db.query(Script).filter(Script.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(script, field, value)

    if payload.body:
        script.word_count = len(script.body.split())

    project = db.query(Project).filter(Project.id == script.project_id).first()
    if project:
        storage_service.save_text(
            project.slug,
            "script",
            "script.txt",
            f"# {script.title}\n\n## Hook\n{script.hook}\n\n## Body\n{script.body}\n\n## Ending\n{script.ending}",
        )

    db.commit()
    db.refresh(script)
    return script
