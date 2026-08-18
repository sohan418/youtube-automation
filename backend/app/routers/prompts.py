from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, PromptTemplate, Script

router = APIRouter(prefix="/prompts", tags=["Prompts"])


def _resolve(template_text: str, **kwargs: str) -> str:
    """Replace {key} placeholders in template text."""
    result = template_text
    for k, v in kwargs.items():
        result = result.replace(f"{{{k}}}", v or "")
    return result


@router.get("/project/{project_id}")
def get_prompts(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    script = (
        db.query(Script)
        .filter(Script.project_id == project_id, Script.is_active.is_(True))
        .first()
    )

    language = project.language if project else "en"
    topic = project.name if project else "General topic"
    ratio = project.ratio if project else "16:9"
    is_shorts = ratio == "9:16"

    script_body = script.body if script else ""
    script_hook = script.hook if script else ""
    script_ending = script.ending if script else ""
    script_title = script.title if script else topic

    # Map step keys to DB keys (with shorts variants)
    key_map = {
        "ideas": "ideas_shorts" if is_shorts else "ideas",
        "script": "script_shorts" if is_shorts else "script",
        "scenes": "scenes_shorts" if is_shorts else "scenes",
        "seo": "seo_shorts" if is_shorts else "seo",
        "thumbnail": "thumbnail_shorts" if is_shorts else "thumbnail",
        "image": "image_shorts" if is_shorts else "image",
    }

    # Template variables available to all prompts
    template_vars = {
        "language": language,
        "topic": topic,
        "ratio": ratio,
        "title": script_title,
        "hook": script_hook,
        "body": script_body[:1500],
        "script_excerpt": script_body[:500],
        "ending": script_ending,
    }

    # Fetch all needed prompt keys in one query
    needed_keys = list(key_map.values())
    rows = (
        db.query(PromptTemplate)
        .filter(PromptTemplate.key.in_(needed_keys))
        .all()
    )
    by_key = {r.key: r for r in rows}

    result = {}
    for step_key, db_key in key_map.items():
        row = by_key.get(db_key)
        if row:
            result[step_key] = {
                "system": _resolve(row.system, **template_vars),
                "user": _resolve(row.user, **template_vars),
            }
        else:
            # Fallback if prompt not seeded yet
            result[step_key] = {"system": "", "user": ""}

    return result
