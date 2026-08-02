from app.config import settings

from .base import TextProvider
from .cli_provider import CLIProvider
from .ollama_provider import OllamaProvider
from .openai_provider import OpenAIProvider

PROVIDERS: dict[str, type[TextProvider]] = {
    "openai": OpenAIProvider,
    "ollama": OllamaProvider,
    "cli": CLIProvider,
    "custom": CLIProvider,
}


def is_placeholder_key(key: str) -> bool:
    cleaned = key.strip().lower()
    if not cleaned or cleaned.startswith("your-") or "your_" in cleaned:
        return True
    return cleaned in {"sk-", "your-api-key"}


def build_provider() -> TextProvider | None:
    """Resolve the active text provider, or None for mock mode."""
    choice = settings.ai_provider.strip().lower()

    if choice == "mock":
        return None

    if choice == "auto":
        if settings.openai_api_key and not is_placeholder_key(settings.openai_api_key):
            return OpenAIProvider()
        if settings.ai_provider_cli.strip():
            return CLIProvider()
        return None

    if choice in PROVIDERS:
        return PROVIDERS[choice]()

    raise ValueError(
        f"Unknown AI_PROVIDER '{settings.ai_provider}'. "
        f"Choose from: {list(PROVIDERS) + ['auto', 'mock']}"
    )


__all__ = [
    "TextProvider",
    "OpenAIProvider",
    "OllamaProvider",
    "CLIProvider",
    "build_provider",
    "is_placeholder_key",
]
