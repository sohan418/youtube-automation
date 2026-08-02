import logging
import shutil
import subprocess
from pathlib import Path

from app.config import settings
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


class VideoService:
    def build_video(
        self,
        slug: str,
        scenes: list[dict],
        background_music: str | None = None,
        resolution: str = "1920x1080",
    ) -> str:
        project_path = storage_service.get_project_path(slug)
        video_dir = project_path / "video"
        video_dir.mkdir(exist_ok=True)

        concat_file = video_dir / "concat_list.txt"
        segment_files: list[Path] = []

        for scene in sorted(scenes, key=lambda s: s["order_index"]):
            order = scene["order_index"]
            image_path = scene.get("image_path")
            audio_path = scene.get("audio_path")
            duration = scene.get("duration_seconds") or 5.0

            if not image_path:
                continue

            full_image = settings.resolve_path(image_path)
            if not full_image.exists():
                full_image = project_path / "images" / f"scene_{order:03d}.png"

            segment = video_dir / f"segment_{order:03d}.mp4"

            if audio_path:
                full_audio = settings.resolve_path(audio_path)
                if not full_audio.exists():
                    full_audio = project_path / "audio" / f"scene_{order:03d}.mp3"

                if (
                    full_audio.exists()
                    and full_image.exists()
                    and self._is_valid_audio(full_audio)
                ):
                    self._create_segment_with_audio(
                        full_image, full_audio, segment, resolution
                    )
                elif full_image.exists():
                    self._create_segment_silent(full_image, segment, duration, resolution)
            elif full_image.exists():
                self._create_segment_silent(full_image, segment, duration, resolution)

            if segment.exists():
                segment_files.append(segment)

        if not segment_files:
            return self._create_placeholder_video(slug, resolution)

        with concat_file.open("w", encoding="utf-8") as f:
            for seg in segment_files:
                f.write(f"file '{seg.as_posix()}'\n")

        output_path = video_dir / "final.mp4"
        self._concat_segments(concat_file, output_path)

        if background_music and output_path.exists():
            music_path = settings.resolve_path(background_music)
            if music_path.exists():
                output_path = self._add_background_music(output_path, music_path, video_dir)

        return str(output_path.relative_to(storage_service.root.parent))

    def _create_segment_with_audio(
        self, image: Path, audio: Path, output: Path, resolution: str
    ) -> None:
        cmd = [
            settings.ffmpeg_path,
            "-y",
            "-loop", "1",
            "-i", str(image),
            "-i", str(audio),
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-s", resolution,
            "-shortest",
            str(output),
        ]
        self._run_ffmpeg(cmd)

    def _create_segment_silent(
        self, image: Path, output: Path, duration: float, resolution: str
    ) -> None:
        cmd = [
            settings.ffmpeg_path,
            "-y",
            "-loop", "1",
            "-i", str(image),
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-pix_fmt", "yuv420p",
            "-s", resolution,
            "-t", str(duration),
            str(output),
        ]
        self._run_ffmpeg(cmd)

    def _concat_segments(self, concat_file: Path, output: Path) -> None:
        cmd = [
            settings.ffmpeg_path,
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_file),
            "-c", "copy",
            str(output),
        ]
        self._run_ffmpeg(cmd)

    def _add_background_music(
        self, video: Path, music: Path, video_dir: Path
    ) -> Path:
        output = video_dir / "final_with_music.mp4"
        cmd = [
            settings.ffmpeg_path,
            "-y",
            "-i", str(video),
            "-i", str(music),
            "-filter_complex",
            "[1:a]volume=0.15[bg];[0:a][bg]amix=inputs=2:duration=first",
            "-c:v", "copy",
            str(output),
        ]
        self._run_ffmpeg(cmd)
        return output if output.exists() else video

    def _create_placeholder_video(self, slug: str, resolution: str) -> str:
        project_path = storage_service.get_project_path(slug)
        video_dir = project_path / "video"
        video_dir.mkdir(exist_ok=True)
        output = video_dir / "final.mp4"

        cmd = [
            settings.ffmpeg_path,
            "-y",
            "-f", "lavfi",
            "-i", f"color=c=0x1e1e3c:s={resolution}:d=5",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            str(output),
        ]
        if self._run_ffmpeg(cmd):
            return str(output.relative_to(storage_service.root.parent))

        output.write_bytes(b"")
        return str(output.relative_to(storage_service.root.parent))

    @staticmethod
    def _is_valid_audio(path: Path) -> bool:
        try:
            if path.stat().st_size < 1024:
                return False
            header = path.read_bytes()[:3]
            return header[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2") or header == b"ID3"
        except OSError:
            return False

    def _run_ffmpeg(self, cmd: list[str]) -> bool:
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=300, check=False
            )
            if result.returncode != 0:
                logger.error("FFmpeg error: %s", result.stderr)
                return False
            return True
        except FileNotFoundError:
            logger.error("FFmpeg not found. Install FFmpeg and add to PATH.")
            return False
        except subprocess.TimeoutExpired:
            logger.error("FFmpeg timed out")
            return False


video_service = VideoService()
