import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Idea, Project, ProjectStatus, Script
from app.schemas import ScriptCreate, ScriptGenerateRequest, ScriptImportRequest, ScriptResponse, ScriptUpdate
from app.services.ai import ai_service
from app.services.storage import storage_service

router = APIRouter(prefix="/scripts", tags=["Scripts"])


class ScriptPromptRequest(BaseModel):
    topic: str | None = None
    language: str | None = None
    target_duration_minutes: int = 5


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

    script = (
        db.query(Script)
        .filter(Script.project_id == project_id)
        .order_by(Script.created_at.desc(), Script.id.desc())
        .first()
    )
    if script is None:
        script = Script(project_id=project_id)
        db.add(script)

    script.title = raw.get("title", topic)
    script.hook = raw.get("hook")
    script.body = body
    script.ending = raw.get("ending")
    script.language = language
    script.word_count = word_count
    script.is_active = True
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


@router.post("/project/{project_id}/import", response_model=ScriptResponse)
def import_script(
    project_id: int, payload: ScriptImportRequest, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Script body cannot be empty")

    language = payload.language or project.language
    title = (payload.title or project.name).strip()
    hook = payload.hook.strip() if payload.hook else None
    ending = payload.ending.strip() if payload.ending else None
    word_count = len(body.split())

    if payload.replace:
        db.query(Script).filter(Script.project_id == project_id).update({"is_active": False})

    script = Script(
        project_id=project_id,
        title=title,
        hook=hook,
        body=body,
        ending=ending,
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
        f"# {title}\n\n## Hook\n{hook}\n\n## Body\n{body}\n\n## Ending\n{ending}",
    )

    db.commit()
    db.refresh(script)
    return script


@router.post("/project/{project_id}", response_model=ScriptResponse)
def create_script(
    project_id: int, payload: ScriptCreate, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Script body cannot be empty")

    language = payload.language or project.language
    word_count = len(body.split())

    db.query(Script).filter(Script.project_id == project_id).update({"is_active": False})

    script = (
        db.query(Script)
        .filter(Script.project_id == project_id)
        .order_by(Script.created_at.desc(), Script.id.desc())
        .first()
    )
    if script is None:
        script = Script(project_id=project_id)
        db.add(script)

    script.title = payload.title.strip()
    script.hook = payload.hook.strip() if payload.hook else None
    script.body = body
    script.ending = payload.ending.strip() if payload.ending else None
    script.language = language
    script.word_count = word_count
    script.is_active = True
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


@router.get("/{script_id}/export")
def export_script(script_id: int, db: Session = Depends(get_db)):
    script = db.query(Script).filter(Script.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    project = db.query(Project).filter(Project.id == script.project_id).first()

    payload = {
        "title": script.title,
        "hook": script.hook,
        "body": script.body,
        "ending": script.ending,
        "language": script.language,
        "word_count": script.word_count,
        "project": project.name if project else None,
        "exported_at": datetime.utcnow().isoformat(),
    }
    content = json.dumps(payload, indent=2, ensure_ascii=False)

    filename = f"script-{project.slug}.json" if project else f"script-{script.id}.json"
    if project:
        storage_service.save_text(project.slug, "script", "script.json", content)

    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


@router.post("/project/{project_id}/prompt")
def build_script_prompt(project_id: int, payload: ScriptPromptRequest, db: Session = Depends(get_db)):
    """Return the exact prompt that would be sent to the LLM for script generation."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    topic = payload.topic or project.name
    return ai_service.build_script_prompt(
        topic=topic,
        language=payload.language or project.language,
        target_duration_minutes=payload.target_duration_minutes,
    )
