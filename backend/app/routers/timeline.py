import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, Timeline
from app.schemas import TimelineData, TimelineResponse

router = APIRouter(prefix="/timeline", tags=["Timeline"])


def _empty_timeline_data() -> TimelineData:
    return TimelineData(version=1, duration=0.0, clips=[], music=None)


@router.get("/project/{project_id}", response_model=TimelineResponse)
def get_timeline(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tl = db.query(Timeline).filter(Timeline.project_id == project_id).first()
    if not tl:
        return TimelineResponse(
            project_id=project_id, data=_empty_timeline_data(), version=0, updated_at=None
        )

    data = TimelineData.model_validate(json.loads(tl.data))
    return TimelineResponse(
        project_id=project_id, data=data, version=tl.version, updated_at=tl.updated_at
    )


@router.put("/project/{project_id}", response_model=TimelineResponse)
def save_timeline(
    project_id: int, payload: TimelineData, db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tl = db.query(Timeline).filter(Timeline.project_id == project_id).first()
    if tl:
        tl.data = payload.model_dump_json()
        tl.version += 1
    else:
        tl = Timeline(project_id=project_id, data=payload.model_dump_json(), version=1)
        db.add(tl)
    db.commit()
    db.refresh(tl)

    return TimelineResponse(
        project_id=project_id, data=payload, version=tl.version, updated_at=tl.updated_at
    )


@router.delete("/project/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def clear_timeline(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tl = db.query(Timeline).filter(Timeline.project_id == project_id).first()
    if tl:
        db.delete(tl)
        db.commit()
    return None
