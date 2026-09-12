import logging
import httpx
from app.config import settings
from .base import TextProvider

logger = logging.getLogger(__name__)


class GroqProvider(TextProvider):
    name = "groq"

    def __init__(self):
        self.api_key = settings.groq_api_key
        self.model = settings.groq_model or "llama-3.3-70b-versatile"

    def complete(self, system: str, prompt: str, json_mode: bool = False) -> str:
        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not configured")

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ]

        payload: dict = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.7,
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise ValueError(f"Groq API returned invalid structure: {data}") from exc
