import json
import re
from abc import ABC, abstractmethod


class TextProvider(ABC):
    name: str = "base"

    @abstractmethod
    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        """Return the model's text completion for the given system/user messages."""

    @staticmethod
    def extract_json(content: str) -> dict | list:
        content = content.strip()
        if not content:
            raise ValueError(
                "AI returned an empty response. Please try again in a moment."
            )
        fenced = re.search(r"```(?:json)?\s*(.*?)```", content, re.DOTALL)
        if fenced:
            content = fenced.group(1).strip()
        try:
            return json.loads(content, strict=False)
        except json.JSONDecodeError:
            first_brace = content.find("{")
            first_bracket = content.find("[")
            if first_bracket != -1 and (first_brace == -1 or first_bracket < first_brace):
                start = first_bracket
                end = content.rfind("]") + 1
            else:
                start = first_brace
                end = content.rfind("}") + 1
            if start != -1 and end > start:
                try:
                    return json.loads(content[start:end], strict=False)
                except json.JSONDecodeError as exc:
                    raise ValueError(
                        "AI returned invalid JSON. Please try again in a moment."
                    ) from exc
            raise
