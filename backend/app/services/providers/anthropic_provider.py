import logging
import httpx
from app.config import settings
from .base import TextProvider

logger = logging.getLogger(__name__)


class AnthropicProvider(TextProvider):
    name = "anthropic"

    def __init__(self):
        self.api_key = settings.anthropic_api_key
        self.model = settings.anthropic_model or "claude-3-5-sonnet-20241022"

    def complete(self, system: str, prompt: str, json_mode: bool = False) -> str:
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY is not configured")

        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        user_content = prompt
        if json_mode:
            user_content += "\n\nIMPORTANT: Respond with valid raw JSON only. Do not include markdown code block syntax."

        payload = {
            "model": self.model,
            "system": system,
            "messages": [{"role": "user", "content": user_content}],
            "max_tokens": 4096,
        }

        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        try:
            return data["content"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise ValueError(f"Anthropic API returned invalid structure: {data}") from exc
