import re
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = ""
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = "sohan@9761"
    db_name: str = "youtube_studio"

    # AI
    openai_api_key: str = ""
    gemini_api_key: str = ""
    # Voice providers — keys can be set here or entered in the UI (persisted to .env)
    sarvam_api_key: str = ""
    deepgram_api_key: str = ""
    elevenlabs_api_key: str = ""
    ai_provider: str = "auto"  # auto | openai | ollama | openrouter | cli | mock
    ai_model: str = ""
    openai_model: str = "gpt-4o-mini"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai"
    ai_provider_cli: str = ""  # e.g. 'claude -p "{prompt}"' or 'gemini -p "{prompt}"'
    cli_timeout_seconds: int = 120

    # Paths
    storage_root: str = "../projects"
    assets_root: str = "../assets"
    exports_root: str = "../exports"
    logs_root: str = "../logs"
    templates_root: str = "../templates"

    # YouTube
    youtube_api_key: str = ""
    youtube_playlist_id: str = ""
    youtube_client_id: str = ""
    youtube_client_secret: str = ""
    youtube_access_token: str = ""
    youtube_refresh_token: str = ""
    youtube_token_expiry: str = ""

    # Misc
    ffmpeg_path: str = "ffmpeg"
    ffmpeg_max_workers: int = 1
    ffmpeg_timeout_seconds: int = 300
    default_language: str = "en"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @model_validator(mode="after")
    def _build_database_url(self) -> "Settings":
        if not self.database_url:
            self.database_url = (
                f"mysql+pymysql://{quote_plus(self.db_user)}:{quote_plus(self.db_password)}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def resolve_path(self, relative: str) -> Path:
        return (BACKEND_DIR / relative).resolve()

    def update_api_key(self, field: str, value: str) -> None:
        env_name = field.upper()
        setattr(self, field, value.strip())
        env_path = BACKEND_DIR / ".env"
        if not env_path.exists():
            env_path.write_text(f"{env_name}={value.strip()}\n", encoding="utf-8")
            return
        lines = env_path.read_text(encoding="utf-8").splitlines()
        pattern = re.compile(rf"^\s*{re.escape(env_name)}\s*=")
        value_line = f"{env_name}={value.strip()}"
        if any(pattern.match(line) for line in lines):
            lines = [value_line if pattern.match(line) else line for line in lines]
        else:
            lines.append(value_line)
        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


settings = Settings()
