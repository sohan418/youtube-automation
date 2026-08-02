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
