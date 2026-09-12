from app.config import settings

from .base import TextProvider
from .cli_provider import CLIProvider
from .ollama_provider import OllamaProvider
from .openai_provider import OpenAIProvider
from .openrouter_provider import OpenRouterProvider
from .gemini_provider import GeminiProvider
from .groq_provider import GroqProvider
from .anthropic_provider import AnthropicProvider

PROVIDERS: dict[str, type[TextProvider]] = {
    "openai": OpenAIProvider,
    "gemini": GeminiProvider,
    "openrouter": OpenRouterProvider,
    "groq": GroqProvider,
    "anthropic": AnthropicProvider,
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
        if settings.gemini_api_key and not is_placeholder_key(settings.gemini_api_key):
            return GeminiProvider()
        if settings.groq_api_key and not is_placeholder_key(settings.groq_api_key):
            return GroqProvider()
        if settings.openrouter_api_key and not is_placeholder_key(settings.openrouter_api_key):
            return OpenRouterProvider()
        if settings.anthropic_api_key and not is_placeholder_key(settings.anthropic_api_key):
            return AnthropicProvider()
        if settings.ai_provider_cli.strip():
            return CLIProvider()
        return None

def get_all_configured_providers(exclude: str | None = None) -> list[TextProvider]:
    """Return instances of all configured providers, optionally excluding a specific provider name."""
    providers: list[TextProvider] = []
    
    order = [
        ("gemini", settings.gemini_api_key, GeminiProvider),
        ("openrouter", settings.openrouter_api_key, OpenRouterProvider),
        ("groq", settings.groq_api_key, GroqProvider),
        ("openai", settings.openai_api_key, OpenAIProvider),
        ("anthropic", settings.anthropic_api_key, AnthropicProvider),
    ]
    
    for name, key, cls in order:
        if name == exclude:
            continue
        if key and not is_placeholder_key(key):
            try:
                providers.append(cls())
            except Exception:
                pass
                
    if settings.ai_provider_cli.strip() and exclude != "cli":
        try:
            providers.append(CLIProvider())
        except Exception:
            pass

    return providers


__all__ = [
    "TextProvider",
    "OpenAIProvider",
    "GeminiProvider",
    "OpenRouterProvider",
    "GroqProvider",
    "AnthropicProvider",
    "OllamaProvider",
    "CLIProvider",
    "build_provider",
    "get_all_configured_providers",
    "is_placeholder_key",
]
