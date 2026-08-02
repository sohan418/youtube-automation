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
    ai_provider: str = "auto"  # auto | openai | ollama | cli | mock
    ai_model: str = ""
    openai_model: str = "gpt-4o-mini"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    ai_provider_cli: str = ""  # e.g. 'claude -p "{prompt}"' or 'gemini -p "{prompt}"'
    cli_timeout_seconds: int = 120

    # Paths
    storage_root: str = "../projects"
    assets_root: str = "../assets"
    exports_root: str = "../exports"
    logs_root: str = "../logs"
    templates_root: str = "../templates"

    # Misc
    ffmpeg_path: str = "ffmpeg"
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


settings = Settings()
