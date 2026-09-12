import logging
import httpx
from app.config import settings
from .base import TextProvider

logger = logging.getLogger(__name__)


class GeminiProvider(TextProvider):
    name = "gemini"

    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model or "gemini-3.6-flash"

    def complete(self, system: str, prompt: str, json_mode: bool = False) -> str:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured")

        models_to_try = [self.model]
        fallbacks = [
            "gemini-flash-latest",
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-pro-latest",
            "gemini-2.5-flash",
        ]
        for m in fallbacks:
            if m not in models_to_try:
                models_to_try.append(m)

        contents = [
            {"role": "user", "parts": [{"text": f"System Instruction: {system}\n\nUser Prompt: {prompt}"}]}
        ]

        last_error = None
        for m in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={self.api_key}"
            payload = {"contents": contents}
            if json_mode:
                payload["generationConfig"] = {"responseMimeType": "application/json"}

            try:
                with httpx.Client(timeout=60.0) as client:
                    resp = client.post(url, json=payload)
                    resp.raise_for_status()
                    data = resp.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"]
            except Exception as exc:
                logger.warning("Gemini model '%s' failed (%s): %s", m, type(exc).__name__, exc)
                last_error = exc

        raise ValueError(f"All Gemini models failed. Last error: {last_error}")
