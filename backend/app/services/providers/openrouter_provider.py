import logging
import httpx

from app.config import settings

from .base import TextProvider

logger = logging.getLogger(__name__)


class OpenRouterProvider(TextProvider):
    name = "openrouter"

    def __init__(self) -> None:
        self.base_url = settings.openrouter_base_url.rstrip("/")
        self.api_key = settings.openrouter_api_key.strip()
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured")
        self.model = settings.ai_model or "openrouter/auto"

    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        models_to_try = [self.model]
        for fallback in ["openrouter/auto", "google/gemini-2.5-flash", "meta-llama/llama-3.3-70b-instruct"]:
            if fallback not in models_to_try:
                models_to_try.append(fallback)

        last_error = None
        for m in models_to_try:
            payload = {
                "model": m,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            }
            if json_mode:
                payload["response_format"] = {"type": "json_object"}

            try:
                response = httpx.post(
                    f"{self.base_url}/api/v1/chat/completions",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    timeout=120.0,
                )
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]
            except Exception as exc:
                logger.warning("OpenRouter model '%s' failed (%s): %s", m, type(exc).__name__, exc)
                last_error = exc

        raise ValueError(f"All OpenRouter models failed. Last error: {last_error}")
