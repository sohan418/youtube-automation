import json
import shutil
from pathlib import Path

from app.config import settings
from app.services.storage import storage_service


class ExportService:
    def export_project(
        self,
        slug: str,
        seo_data: dict | None = None,
        scenes: list[dict] | None = None,
    ) -> tuple[str, list[str]]:
        export_dir = storage_service.get_export_path(slug)
        project_path = storage_service.get_project_path(slug)
        exported_files: list[str] = []

        for subdir in ["video", "thumbnail", "images", "audio", "script", "metadata"]:
            src = project_path / subdir
            if not src.exists():
                continue
            dest = export_dir / subdir
            dest.mkdir(exist_ok=True)
            for file in src.iterdir():
                if file.is_file():
                    shutil.copy2(file, dest / file.name)
                    exported_files.append((dest / file.name).relative_to(export_dir).as_posix())

        if seo_data:
            seo_path = export_dir / "metadata" / "seo.json"
            seo_path.parent.mkdir(exist_ok=True)
            seo_path.write_text(json.dumps(seo_data, indent=2, ensure_ascii=False), encoding="utf-8")
            exported_files.append("metadata/seo.json")

        if scenes:
            srt_path = export_dir / "metadata" / "subtitles.srt"
            srt_path.parent.mkdir(exist_ok=True)
            srt_content = self._generate_srt(scenes)
            srt_path.write_text(srt_content, encoding="utf-8")
            exported_files.append("metadata/subtitles.srt")

        readme = export_dir / "UPLOAD_README.txt"
        readme.write_text(
            "YouTube Content Studio Export\n"
            "=============================\n\n"
            f"Project: {slug}\n\n"
            "Contents:\n"
            "- video/final.mp4 — Main video file\n"
            "- thumbnail/ — Thumbnail options\n"
            "- metadata/seo.json — Title, description, tags\n"
            "- metadata/subtitles.srt — Subtitle file\n\n"
            "Upload these files manually to YouTube Studio.\n",
            encoding="utf-8",
        )
        exported_files.append("UPLOAD_README.txt")

        return export_dir.relative_to(storage_service.root.parent).as_posix(), exported_files

    @staticmethod
    def _generate_srt(scenes: list[dict]) -> str:
        lines: list[str] = []
        current_time = 0.0

        for i, scene in enumerate(sorted(scenes, key=lambda s: s.get("order_index", 0)), 1):
            duration = scene.get("duration_seconds") or 5.0
            start = ExportService._format_srt_time(current_time)
            end = ExportService._format_srt_time(current_time + duration)
            narration = scene.get("narration", "")

            lines.append(str(i))
            lines.append(f"{start} --> {end}")
            lines.append(narration)
            lines.append("")
            current_time += duration

        return "\n".join(lines)

    @staticmethod
    def _format_srt_time(seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


export_service = ExportService()
