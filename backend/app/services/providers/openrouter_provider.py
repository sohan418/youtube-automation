import httpx

from app.config import settings

from .base import TextProvider


class OpenRouterProvider(TextProvider):
    name = "openrouter"

    def __init__(self) -> None:
        self.base_url = settings.openrouter_base_url.rstrip("/")
        self.api_key = settings.openrouter_api_key.strip()
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY is not configured")
        self.model = settings.ai_model or "openrouter/free"

    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
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
