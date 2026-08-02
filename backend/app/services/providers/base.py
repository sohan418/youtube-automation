import json
import re
from abc import ABC, abstractmethod


class TextProvider(ABC):
    name: str = "base"

    @abstractmethod
    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        """Return the model's text completion for the given system/user messages."""

    @staticmethod
    def extract_json(content: str) -> dict:
        content = content.strip()
        fenced = re.search(r"```(?:json)?\s*(.*?)```", content, re.DOTALL)
        if fenced:
            content = fenced.group(1).strip()
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}") + 1
            if start != -1 and end > start:
                return json.loads(content[start:end])
            raise
