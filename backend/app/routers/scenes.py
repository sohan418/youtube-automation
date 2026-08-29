from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectStatus, Scene, SceneImage, Script
from app.schemas import SceneCreate, SceneGenerateRequest, SceneImportRequest, SceneResponse, SceneUpdate
from app.services.ai import ai_service
from app.services.storage import storage_service

router = APIRouter(prefix="/scenes", tags=["Scenes"])


class ScenePromptRequest(BaseModel):
    script_body: str | None = None
    hook: str | None = None
    ending: str | None = None
    language: str | None = None
    count: int | None = None
    ratio: str | None = None


def _delete_scene_files(db: Session, scene: Scene) -> None:
    for img in scene.scene_images:
        referenced = (
            db.query(SceneImage)
            .filter(SceneImage.file_path == img.file_path, SceneImage.id != img.id)
            .count()
        )
        if referenced == 0:
            try:
                path = storage_service.root.parent / img.file_path
                if path.exists():
                    path.unlink()
            except OSError:
                pass
    for vid in scene.scene_videos:
        try:
            path = storage_service.root.parent / vid.file_path
            if path.exists():
                path.unlink()
        except OSError:
            pass


def _renumber_scenes(db: Session, project_id: int) -> None:
    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order_index)
        .all()
    )
    for i, scene in enumerate(scenes, start=1):
        if scene.order_index != i:
            scene.order_index = i


@router.get("/project/{project_id}", response_model=list[SceneResponse])
def list_scenes(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order_index)
        .all()
    )


@router.post("/project/{project_id}", response_model=SceneResponse)
def create_scene(
    project_id: int, payload: SceneCreate, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    script_id = payload.script_id
    if script_id is None:
        active = (
            db.query(Script)
            .filter(Script.project_id == project_id, Script.is_active.is_(True))
            .order_by(Script.id.desc())
            .first()
        )
        if active:
            script_id = active.id
    if script_id is None:
        raise HTTPException(
            status_code=400,
            detail="No script found for this project. Generate a script first.",
        )

    script = db.query(Script).filter(Script.id == script_id).first()
    if not script or script.project_id != project_id:
        raise HTTPException(status_code=404, detail="Script not found")

    max_order = (
        db.query(Scene).filter(Scene.project_id == project_id).count()
    )
    target = max_order + 1
    if payload.order_index is not None:
        target = max(1, min(int(payload.order_index), max_order + 1))
        shift = (
            db.query(Scene)
            .filter(Scene.project_id == project_id, Scene.order_index >= target)
            .order_by(Scene.order_index.desc())
            .all()
        )
        for sc in shift:
            sc.order_index += 1
        db.flush()

    scene = Scene(
        project_id=project_id,
        script_id=script.id,
        order_index=target,
        narration=payload.narration,
        image_prompt=payload.image_prompt,
        video_prompt=payload.video_prompt,
    )
    db.add(scene)
    project.status = ProjectStatus.SCENES
    db.commit()
    db.refresh(scene)
    return scene


@router.post("/project/{project_id}/generate", response_model=list[SceneResponse])
def generate_scenes(
    project_id: int, payload: SceneGenerateRequest, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    script = db.query(Script).filter(Script.id == payload.script_id).first()
    if not script or script.project_id != project_id:
        raise HTTPException(status_code=404, detail="Script not found")

    old_scenes = db.query(Scene).filter(Scene.script_id == script.id).all()
    for old in old_scenes:
        _delete_scene_files(db, old)
        db.delete(old)
    db.flush()

    try:
        raw_scenes = ai_service.generate_scenes(
            script.body,
            script.hook or "",
            script.ending or "",
            language=script.language or project.language,
            count=payload.count,
            ratio=project.ratio or "16:9",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=502, detail=f"AI scene generation failed: {exc}"
        ) from exc

    scenes: list[Scene] = []
    for i, raw in enumerate(raw_scenes):
        scene = Scene(
            project_id=project_id,
            script_id=script.id,
            order_index=i + 1,
            narration=raw.get("narration", ""),
            image_prompt=raw.get("image_prompt"),
            video_prompt=raw.get("video_prompt"),
        )
        db.add(scene)
        scenes.append(scene)

    project.status = ProjectStatus.SCENES
    db.commit()
    for scene in scenes:
        db.refresh(scene)
    return scenes


@router.delete("/project/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def clear_scenes(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order_index)
        .all()
    )
    for scene in scenes:
        _delete_scene_files(db, scene)
        db.delete(scene)
    db.commit()
    return None


@router.patch("/{scene_id}", response_model=SceneResponse)
def update_scene(scene_id: int, payload: SceneUpdate, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(scene, field, value)
    if data.get("duration_seconds") is not None:
        scene.duration_manual = True

    db.commit()
    db.refresh(scene)
    return scene


@router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scene(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    project_id = scene.project_id
    _delete_scene_files(db, scene)
    db.delete(scene)
    db.flush()
    _renumber_scenes(db, project_id)
    db.commit()
    return None


@router.post("/project/{project_id}/import", response_model=list[SceneResponse])
def import_scenes(
    project_id: int, payload: SceneImportRequest, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    script = (
        db.query(Script)
        .filter(Script.project_id == project_id, Script.is_active.is_(True))
        .order_by(Script.id.desc())
        .first()
    )
    if not script:
        script = Script(
            project_id=project_id,
            title=project.name,
            body="Imported script",
            language=project.language,
            is_active=True,
        )
        db.add(script)
        db.flush()

    if payload.replace:
        old_scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
        for old in old_scenes:
            _delete_scene_files(db, old)
            db.delete(old)
        db.flush()

    existing_count = db.query(Scene).filter(Scene.project_id == project_id).count()

    imported_scenes: list[Scene] = []
    for i, item in enumerate(payload.scenes, start=1):
        if not item.narration.strip():
            continue
        scene = Scene(
            project_id=project_id,
            script_id=script.id,
            order_index=existing_count + i if not payload.replace else i,
            narration=item.narration.strip(),
            image_prompt=item.image_prompt.strip() if item.image_prompt else None,
            video_prompt=item.video_prompt.strip() if item.video_prompt else None,
        )
        db.add(scene)
        imported_scenes.append(scene)

    project.status = ProjectStatus.SCENES
    db.commit()
    return list_scenes(project_id, db)


@router.post("/project/{project_id}/prompt")
def build_scene_prompt(project_id: int, payload: ScenePromptRequest, db: Session = Depends(get_db)):
    """Return the exact prompt that would be sent to the LLM for scene generation."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    active_script = (
        db.query(Script)
        .filter(Script.project_id == project_id, Script.is_active.is_(True))
        .first()
    )

    return ai_service.build_scenes_prompt(
        script_body=payload.script_body or (active_script.body if active_script else ""),
        hook=payload.hook or (active_script.hook if active_script else ""),
        ending=payload.ending or (active_script.ending if active_script else ""),
        language=payload.language or project.language,
        count=payload.count,
        ratio=payload.ratio or project.ratio or "16:9",
    )
