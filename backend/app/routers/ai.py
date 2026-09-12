from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ai import ai_service

router = APIRouter(prefix="/ai", tags=["AI"])


class TextGenerateRequest(BaseModel):
    system: str = "You are a helpful assistant."
    prompt: str
    json_mode: bool = False


class TextGenerateResponse(BaseModel):
    output: str
    provider: str


@router.post("/generate", response_model=TextGenerateResponse)
def generate_text(payload: TextGenerateRequest):
    try:
        output = ai_service.complete(
            payload.system, payload.prompt, json_mode=payload.json_mode
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502, detail=f"AI provider ({ai_service.provider_name}) failed: {exc}"
        ) from exc
    return TextGenerateResponse(output=output, provider=ai_service.provider_name)


class AutoProduceRequest(BaseModel):
    topic: str
    category: str = "Technology"
    language: str = "en"
    duration_minutes: int = 3
    hitl_mode: bool = True


@router.post("/projects/{project_id}/auto-produce")
def trigger_auto_produce(project_id: int, payload: AutoProduceRequest):
    from app.services.langchain_producer import launch_producer_agent_bg, PRODUCER_TASKS

    # Clear previous status if any
    PRODUCER_TASKS[project_id] = {
        "project_id": project_id,
        "status": "running",
        "stage": "Initializing LangChain Agent...",
        "progress": 5.0,
        "logs": ["LangChain Agent initialized"],
        "error": None,
        "video_url": None,
        "waiting_approval": False,
        "approval_stage": None,
    }

    launch_producer_agent_bg(
        project_id=project_id,
        topic=payload.topic,
        category=payload.category,
        language=payload.language,
        duration_minutes=payload.duration_minutes,
        hitl_mode=payload.hitl_mode,
    )

    return {"message": "LangChain Auto-Producer Agent launched", "project_id": project_id, "hitl_mode": payload.hitl_mode}


class AutoProduceApproveRequest(BaseModel):
    stage: str = "script"


@router.post("/projects/{project_id}/auto-produce/approve")
def approve_auto_produce_step(project_id: int, payload: AutoProduceApproveRequest):
    from app.services.langchain_producer import resume_producer_agent_bg
    try:
        res = resume_producer_agent_bg(project_id=project_id, stage=payload.stage)
        return res
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/projects/{project_id}/auto-produce/status")
def get_auto_produce_status(project_id: int):
    from app.services.langchain_producer import PRODUCER_TASKS

    task = PRODUCER_TASKS.get(project_id)
    if not task:
        return {
            "project_id": project_id,
            "status": "idle",
            "stage": "Not Started",
            "progress": 0.0,
            "logs": [],
            "error": None,
            "video_url": None,
            "waiting_approval": False,
            "approval_stage": None,
        }

    # Clean non-serializable agent objects before returning JSON
    return {
        "project_id": task.get("project_id", project_id),
        "status": task.get("status", "idle"),
        "stage": task.get("stage", "Not Started"),
        "progress": task.get("progress", 0.0),
        "logs": task.get("logs", []),
        "error": task.get("error"),
        "video_url": task.get("video_url"),
        "waiting_approval": task.get("waiting_approval", False),
        "approval_stage": task.get("approval_stage"),
    }


class ProjectChatRequest(BaseModel):
    message: str


@router.post("/projects/{project_id}/chat")
async def project_chat(project_id: int, payload: ProjectChatRequest):
    from app.services.langchain_copilot import LangChainCopilotAgent

    agent = LangChainCopilotAgent(project_id=project_id)
    result = await agent.chat(user_message=payload.message)
    return result


@router.get("/projects/{project_id}/chat/history")
def get_project_chat_history(project_id: int):
    from app.services.langchain_copilot import LangChainCopilotAgent

    agent = LangChainCopilotAgent(project_id=project_id)
    return {"history": agent.get_history()}


@router.delete("/projects/{project_id}/chat/history")
def clear_project_chat_history(project_id: int):
    from app.services.langchain_copilot import LangChainCopilotAgent

    agent = LangChainCopilotAgent(project_id=project_id)
    return {"history": agent.clear_history()}
