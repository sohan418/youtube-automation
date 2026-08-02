from openai import OpenAI

from app.config import settings

from .base import TextProvider


class OpenAIProvider(TextProvider):
    name = "openai"

    def __init__(self) -> None:
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.ai_model or settings.openai_model or "gpt-4o-mini"

    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        kwargs = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.8,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""
