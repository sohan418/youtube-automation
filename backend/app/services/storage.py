import re
from pathlib import Path

from app.config import settings


class StorageService:
    PROJECT_SUBDIRS = [
        "script",
        "scenes",
        "images",
        "audio",
        "video",
        "thumbnail",
        "metadata",
        "clips",
    ]

    def __init__(self) -> None:
        self.root = settings.resolve_path(settings.storage_root)
        self.assets_root = settings.resolve_path(settings.assets_root)
        self.exports_root = settings.resolve_path(settings.exports_root)
        self.logs_root = settings.resolve_path(settings.logs_root)
        self.templates_root = settings.resolve_path(settings.templates_root)
        self._ensure_roots()

    def _ensure_roots(self) -> None:
        for path in [
            self.root,
            self.assets_root,
            self.exports_root,
            self.logs_root,
            self.templates_root,
        ]:
            path.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def slugify(name: str) -> str:
        slug = name.lower().strip()
        slug = re.sub(r"[^\w\s-]", "", slug)
        slug = re.sub(r"[\s_-]+", "-", slug)
        return slug.strip("-") or "project"

    def create_project_folder(self, slug: str) -> Path:
        project_path = self.root / slug
        project_path.mkdir(parents=True, exist_ok=True)
        for subdir in self.PROJECT_SUBDIRS:
            (project_path / subdir).mkdir(exist_ok=True)
        return project_path

    def get_project_path(self, slug: str) -> Path:
        return self.root / slug

    def save_text(self, slug: str, subdir: str, filename: str, content: str) -> str:
        folder = self.get_project_path(slug) / subdir
        folder.mkdir(parents=True, exist_ok=True)
        file_path = folder / filename
        file_path.write_text(content, encoding="utf-8")
        return str(file_path.relative_to(self.root.parent))

    def save_binary(self, slug: str, subdir: str, filename: str, data: bytes) -> str:
        folder = self.get_project_path(slug) / subdir
        folder.mkdir(parents=True, exist_ok=True)
        file_path = folder / filename
        file_path.write_bytes(data)
        return str(file_path.relative_to(self.root.parent))

    def get_export_path(self, slug: str) -> Path:
        export_path = self.exports_root / slug
        export_path.mkdir(parents=True, exist_ok=True)
        return export_path


storage_service = StorageService()
