import logging
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

VIDEO_RATIOS: dict[str, dict] = {
    "16:9": {"label": "Landscape (YouTube)", "width": 1920, "height": 1080},
    "9:16": {"label": "Portrait (Shorts)", "width": 1080, "height": 1920},
}


class VideoService:
    def __init__(self) -> None:
        self._progress: dict[str, dict] = {}

    def set_progress(
        self,
        slug: str,
        progress: int,
        stage: str,
        message: str,
        *,
        running: bool = True,
        output: str | None = None,
        error: str | None = None,
    ) -> None:
        self._progress[slug] = {
            "running": running,
            "progress": max(0, min(100, progress)),
            "stage": stage,
            "message": message,
            "output": output,
            "error": error,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    def get_progress(self, slug: str) -> dict:
        if slug not in self._progress:
            return {
                "running": False,
                "progress": 0,
                "stage": "idle",
                "message": "No video build in progress.",
                "output": None,
                "error": None,
                "updated_at": None,
            }
        return self._progress[slug]

    def ratio_list(self) -> list[dict]:
        items = []
        for ratio_id, info in VIDEO_RATIOS.items():
            items.append(
                {
                    "id": ratio_id,
                    "label": info["label"],
                    "width": info["width"],
                    "height": info["height"],
                    "resolution": f"{info['width']}x{info['height']}",
                }
            )
        return items

    def resolve_resolution(self, ratio: str | None, resolution: str | None) -> str:
        if resolution:
            return resolution
        ratio_info = VIDEO_RATIOS.get(ratio or "16:9")
        if not ratio_info:
            raise ValueError(
                f"Unknown ratio '{ratio}'. Available: {', '.join(VIDEO_RATIOS)}"
            )
        return f"{ratio_info['width']}x{ratio_info['height']}"

    @staticmethod
    def _resolve_scene_path(path_str: str) -> Path:
        if not path_str:
            return Path()
        path = Path(path_str)
        if path.is_absolute():
            return path
        return (storage_service.root.parent / path).resolve()

    def global_music_dir(self) -> Path:
        p = storage_service.assets_root / "music"
        p.mkdir(parents=True, exist_ok=True)
        return p

    def list_global_music(self) -> list[dict]:
        folder = self.global_music_dir()
        valid_exts = {".mp3", ".wav", ".aac", ".ogg", ".m4a", ".flac"}
        tracks: list[dict] = []
        for file in sorted(folder.iterdir()):
            if file.is_file() and file.suffix.lower() in valid_exts:
                duration = self._probe_audio_duration(file)
                name = file.stem.replace("_", " ").replace("-", " ").title()
                rel_path = f"assets/music/{file.name}"
                tracks.append(
                    {
                        "filename": file.name,
                        "name": name,
                        "file_path": rel_path,
                        "duration_seconds": duration,
                        "size_bytes": file.stat().st_size,
                    }
                )
        return tracks

    def save_global_music(self, filename: str, content: bytes) -> dict:
        folder = self.global_music_dir()
        clean_name = re.sub(r"[^\w.-]", "_", filename).strip("_")
        if not clean_name:
            clean_name = f"track_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3"
        dest = folder / clean_name
        dest.write_bytes(content)
        duration = self._probe_audio_duration(dest)
        return {
            "filename": dest.name,
            "name": dest.stem.replace("_", " ").replace("-", " ").title(),
            "file_path": f"assets/music/{dest.name}",
            "duration_seconds": duration,
            "size_bytes": len(content),
        }

    def delete_global_music(self, filename: str) -> bool:
        folder = self.global_music_dir()
        target = (folder / filename).resolve()
        if target.is_file() and str(target).startswith(str(folder.resolve())):
            target.unlink()
            return True
        return False

    def global_clips_dir(self) -> Path:
        p = storage_service.assets_root / "clips"
        p.mkdir(parents=True, exist_ok=True)
        return p

    def list_global_clips(self) -> list[dict]:
        folder = self.global_clips_dir()
        valid_exts = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}
        clips: list[dict] = []
        for file in sorted(folder.iterdir()):
            if file.is_file() and file.suffix.lower() in valid_exts:
                info = self._probe_video_info(file)
                name = file.stem.replace("_", " ").replace("-", " ").title()
                rel_path = f"assets/clips/{file.name}"
                clips.append(
                    {
                        "filename": file.name,
                        "name": name,
                        "file_path": rel_path,
                        "duration_seconds": info["duration"] if info else None,
                        "width": info["width"] if info else None,
                        "height": info["height"] if info else None,
                        "size_bytes": file.stat().st_size,
                    }
                )
        return clips

    def save_global_clip(self, filename: str, content: bytes) -> dict:
        folder = self.global_clips_dir()
        clean_name = re.sub(r"[^\w.-]", "_", filename).strip("_")
        if not clean_name:
            clean_name = f"clip_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
        dest = folder / clean_name
        dest.write_bytes(content)
        info = self._probe_video_info(dest)
        return {
            "filename": dest.name,
            "name": dest.stem.replace("_", " ").replace("-", " ").title(),
            "file_path": f"assets/clips/{dest.name}",
            "duration_seconds": info["duration"] if info else None,
            "width": info["width"] if info else None,
            "height": info["height"] if info else None,
            "size_bytes": len(content),
        }

    def delete_global_clip(self, filename: str) -> bool:
        folder = self.global_clips_dir()
        target = (folder / filename).resolve()
        if target.is_file() and str(target).startswith(str(folder.resolve())):
            target.unlink()
            return True
        return False

    @staticmethod
    def _parse_resolution(resolution: str) -> tuple[int, int]:
        parts = resolution.lower().split("x")
        try:
            return int(parts[0]), int(parts[1])
        except (ValueError, IndexError):
            return 1920, 1080

    def _probe_video_info(self, path: Path) -> dict | None:
        try:
            result = subprocess.run(
                [
                    "ffprobe", "-v", "error",
                    "-select_streams", "v:0",
                    "-show_entries", "stream=width,height:format=duration",
                    "-of", "json",
                    str(path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                return None
            import json

            data = json.loads(result.stdout or "{}")
            stream = (data.get("streams") or [{}])[0]
            duration = data.get("format", {}).get("duration")
            return {
                "width": stream.get("width"),
                "height": stream.get("height"),
                "duration": float(duration) if duration else None,
            }
        except (OSError, ValueError, subprocess.TimeoutExpired, json.JSONDecodeError):
            return None

    @staticmethod
    def _is_valid_video(path: Path) -> bool:
        try:
            if path.stat().st_size < 1024:
                return False
            header = path.read_bytes()[:16]
            if header.startswith(b"\x1a\x45\xdf\xa3"):
                return True  # matroska / webm
            return header[4:8] == b"ftyp"  # mp4 / mov / m4v
        except OSError:
            return False

    def _create_video_segment(
        self,
        video: Path,
        audio: Path | None,
        start: float,
        duration: float,
        output: Path,
        resolution: str,
        volume: float = 1.0,
        video_start: float | None = None,
    ) -> None:
        width, height = self._parse_resolution(resolution)
        vf = (
            f"scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},setsar=1"
        )
        v_ss = video_start if video_start is not None else start
        cmd = [
            settings.ffmpeg_path,
            "-y",
            "-ss", f"{v_ss:.3f}",
            "-t", f"{duration:.3f}",
            "-i", str(video),
        ]
        if audio is not None:
            cmd += ["-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(audio)]
            cmd += ["-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k"]
        elif self._has_audio_stream(video):
            safe_volume = max(0.01, min(1.0, float(volume)))
            cmd += [
                "-map", "0:v", "-map", "0:a",
                "-af", f"volume={safe_volume:.3f}",
                "-c:a", "aac", "-b:a", "192k",
            ]
        else:
            cmd += ["-map", "0:v"]
        cmd += [
            "-vf", vf,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-t", f"{duration:.3f}",
            str(output),
        ]
        self._run_ffmpeg(cmd)

    def build_video(
        self,
        slug: str,
        scenes: list[dict],
        background_music: str | None = None,
        music_volume: float = 0.12,
        ratio: str = "16:9",
        resolution: str | None = None,
    ) -> str:
        resolution = self.resolve_resolution(ratio, resolution)
        project_path = storage_service.get_project_path(slug)
        video_dir = project_path / "video"
        video_dir.mkdir(exist_ok=True)

        concat_file = video_dir / "concat_list.txt"

        self.set_progress(slug, 1, "preparing", "Preparing video scenes...")
        plans: list[dict] = []
        for scene in sorted(scenes, key=lambda s: s["order_index"]):
            order = scene["order_index"]
            duration = scene.get("duration_seconds") or 5.0

            media = self._resolve_scene_media(scene, project_path)
            if not media:
                continue

            audio_path = scene.get("audio_path")
            full_audio: Path | None = None
            audio_ok = False
            if audio_path:
                full_audio = self._resolve_scene_path(audio_path)
                if not full_audio.exists():
                    wav_fallback = project_path / "audio" / f"scene_{order:03d}.wav"
                    mp3_fallback = project_path / "audio" / f"scene_{order:03d}.mp3"
                    full_audio = mp3_fallback if mp3_fallback.exists() else wav_fallback
                if full_audio.exists() and self._is_valid_audio(full_audio):
                    audio_ok = True

            plans.append(
                {
                    "order": order,
                    "media": media,
                    "audio_ok": audio_ok,
                    "full_audio": full_audio,
                    "duration": duration,
                }
            )

        if not plans:
            return self._create_placeholder_video(slug, resolution)

        total_images = sum(len(p["media"]) for p in plans)
        done_images = 0
        segment_files: list[Path] = []

        for plan in plans:
            order = plan["order"]
            duration = plan["duration"]
            media = plan["media"]
            audio_ok = plan["audio_ok"]
            full_audio = plan["full_audio"]

            segment = video_dir / f"segment_{order:03d}.mp4"

            if len(media) == 1:
                item = media[0]
                done_images += 1
                label = "video clip" if item["kind"] == "video" else "image"
                self.set_progress(
                    slug,
                    int(2 + 88 * done_images / total_images),
                    "rendering",
                    f"Rendering scene {order} {label} ({done_images}/{total_images} media)...",
                )
                if item["kind"] == "video":
                    audio_for_video = full_audio if audio_ok else None
                    self._create_video_segment(
                        item["path"],
                        audio_for_video,
                        0,
                        duration,
                        segment,
                        resolution,
                    )
                elif audio_ok:
                    self._create_segment_with_audio(item["path"], full_audio, segment, resolution)
                else:
                    self._create_segment_silent(item["path"], segment, duration, resolution)
            else:
                sub_segments: list[Path] = []
                part = max(duration / len(media), 0.5)
                audio_len = None
                if audio_ok:
                    audio_len = self._probe_audio_duration(full_audio)
                for k, item in enumerate(media):
                    done_images += 1
                    self.set_progress(
                        slug,
                        int(2 + 88 * done_images / total_images),
                        "rendering",
                        f"Rendering scene {order} media {k + 1}/{len(media)} ({done_images}/{total_images} media)...",
                    )
                    seg = video_dir / f"scene_{order:03d}_media{k:02d}.mp4"
                    start = k * part
                    has_audio = audio_ok and (audio_len is None or start < audio_len)
                    if item["kind"] == "video":
                        audio_for_video = full_audio if has_audio else None
                        self._create_video_segment(
                            item["path"],
                            audio_for_video,
                            start,
                            part,
                            seg,
                            resolution,
                            video_start=0.0,
                        )
                    elif has_audio:
                        self._create_segment_with_audio_slice(
                            item["path"], full_audio, start, part, seg, resolution
                        )
                    else:
                        self._create_segment_silent(item["path"], seg, part, resolution)
                    if seg.exists():
                        sub_segments.append(seg)

                if sub_segments:
                    self.set_progress(slug, 91, "joining", f"Joining scene {order} media...")
                    self._concat_list(sub_segments, segment)

            if segment.exists():
                segment_files.append(segment)

        self.set_progress(slug, 92, "joining", "Joining all scene segments...")
        with concat_file.open("w", encoding="utf-8") as f:
            for seg in segment_files:
                f.write(f"file '{seg.as_posix()}'\n")

        output_path = video_dir / "final.mp4"
        self._concat_segments(concat_file, output_path)

        if background_music and output_path.exists():
            music_path = self._resolve_scene_path(background_music)
            if music_path.exists():
                self.set_progress(slug, 96, "music", "Mixing background music...")
                output_path = self._add_background_music(
                    output_path, music_path, video_dir, volume=music_volume
                )

        relative = str(output_path.relative_to(storage_service.root.parent))
        self.set_progress(
            slug, 100, "done", "Video built successfully", running=False, output=relative
        )
        return relative

    def build_timeline(
        self,
        slug: str,
        timeline: dict,
        background_music: str | None = None,
        music_volume: float = 0.12,
        ratio: str = "16:9",
        resolution: str | None = None,
    ) -> str:
        resolution = self.resolve_resolution(ratio, resolution)
        project_path = storage_service.get_project_path(slug)
        video_dir = project_path / "video"
        video_dir.mkdir(exist_ok=True)

        clips = [c for c in timeline.get("clips") or [] if c.get("track") == "video"]
        if not clips:
            return self._create_placeholder_video(slug, resolution)

        ordered = sorted(clips, key=lambda c: c.get("start", 0.0))
        concat_file = video_dir / "concat_list_timeline.txt"
        segment_files: list[Path] = []
        total = len(ordered)

        self.set_progress(slug, 2, "preparing", f"Rendering {total} timeline clip(s)...")
        for idx, clip in enumerate(ordered, start=1):
            image = self._resolve_timeline_asset(clip.get("image_path"), project_path)
            video = self._resolve_timeline_asset(clip.get("video_path"), project_path)
            audio = self._resolve_timeline_asset(clip.get("audio_path"), project_path)
            duration = max(0.5, float(clip.get("duration") or 5.0))
            audio_in = max(0.0, float(clip.get("audio_in") or 0.0))
            segment = video_dir / f"timeline_clip_{idx:03d}.mp4"

            self.set_progress(
                slug,
                int(2 + 90 * idx / total),
                "rendering",
                f"Rendering timeline clip {idx}/{total} ({duration:.1f}s)...",
            )
            if video and video.exists() and self._is_valid_video(video):
                audio_for_video = audio if audio and audio.exists() else None
                self._create_video_segment(
                    video,
                    audio_for_video,
                    audio_in,
                    duration,
                    segment,
                    resolution,
                    volume=float(clip.get("volume") or 1.0),
                )
            elif audio and audio.exists() and self._is_valid_audio(audio):
                self._create_segment_with_audio_slice(
                    image, audio, audio_in, duration, segment, resolution
                )
            else:
                self._create_segment_silent(image, segment, duration, resolution)
            if segment.exists():
                segment_files.append(segment)

        if not segment_files:
            return self._create_placeholder_video(slug, resolution)

        self.set_progress(slug, 93, "joining", "Joining timeline clips...")
        with concat_file.open("w", encoding="utf-8") as f:
            for seg in segment_files:
                f.write(f"file '{seg.as_posix()}'\n")

        output_path = video_dir / "final.mp4"
        self._concat_segments(concat_file, output_path)

        if background_music and output_path.exists():
            music_path = self._resolve_scene_path(background_music)
            if music_path.exists():
                self.set_progress(slug, 96, "music", "Mixing background music...")
                output_path = self._add_background_music(
                    output_path, music_path, video_dir, volume=music_volume
                )

        relative = str(output_path.relative_to(storage_service.root.parent))
        self.set_progress(
            slug, 100, "done", "Video built successfully", running=False, output=relative
        )
        return relative

    @staticmethod
    def _resolve_timeline_asset(path_str: str | None, project_path: Path) -> Path:
        if not path_str:
            return Path()
        path = Path(path_str)
        if path.is_absolute():
            return path
        return (storage_service.root.parent / path).resolve()

    def _resolve_scene_media(self, scene: dict, project_path: Path) -> list[dict]:
        items: list[tuple[int, str, Path]] = []

        def resolve(path_str: str | None) -> Path | None:
            if not path_str:
                return None
            resolved = self._resolve_scene_path(path_str)
            return resolved if resolved.exists() else None

        def item_from_entry(entry) -> tuple[str, int]:
            if isinstance(entry, dict):
                return entry.get("file_path", ""), int(entry.get("position") or 0)
            return str(entry), 0

        for entry in scene.get("images") or []:
            fp, pos = item_from_entry(entry)
            resolved = resolve(fp)
            if resolved:
                items.append((pos, "image", resolved))

        for entry in scene.get("videos") or []:
            fp, pos = item_from_entry(entry)
            resolved = resolve(fp)
            if resolved and self._is_valid_video(resolved):
                items.append((pos, "video", resolved))

        if not items:
            primary = scene.get("image_path")
            primary_path = resolve(primary)
            if primary_path:
                items.append((0, "image", primary_path))

        if not items:
            fallback = project_path / "images" / f"scene_{scene.get('order_index', 1):03d}.png"
            if fallback.exists():
                items.append((0, "image", fallback))

        items.sort(key=lambda x: x[0])
        return [{"kind": kind, "path": path} for _, kind, path in items]

    def _probe_audio_duration(self, path: Path) -> float | None:
        try:
            result = subprocess.run(
                [
                    "ffprobe", "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    str(path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                return float(result.stdout.strip())
        except (OSError, ValueError, subprocess.TimeoutExpired):
            pass
        return None

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

    def _create_segment_with_audio_slice(
        self,
        image: Path,
        audio: Path,
        start: float,
        duration: float,
        output: Path,
        resolution: str,
    ) -> None:
        cmd = [
            settings.ffmpeg_path,
            "-y",
            "-loop", "1",
            "-i", str(image),
            "-ss", f"{start:.3f}",
            "-t", f"{duration:.3f}",
            "-i", str(audio),
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-c:a", "aac",
            "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-s", resolution,
            "-t", f"{duration:.3f}",
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

    def _concat_list(self, segments: list[Path], output: Path) -> None:
        import tempfile

        lines = "\n".join(f"file '{seg.as_posix()}'" for seg in segments)
        with tempfile.NamedTemporaryFile(
            "w", suffix=".txt", delete=False, encoding="utf-8"
        ) as tmp:
            tmp.write(lines)
            tmp_path = tmp.name
        try:
            self._concat_segments(Path(tmp_path), output)
        finally:
            try:
                Path(tmp_path).unlink()
            except OSError:
                pass

    def _add_background_music(
        self, video: Path, music: Path, video_dir: Path, volume: float = 0.12
    ) -> Path:
        output = video_dir / "final_with_music.mp4"
        safe_volume = max(0.01, min(1.0, float(volume)))

        if self._has_audio_stream(video):
            filter_complex = (
                f"[1:a]volume={safe_volume:.3f}[bg];"
                f"[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[mix]"
            )
            cmd = [
                settings.ffmpeg_path,
                "-y",
                "-i", str(video),
                "-stream_loop", "-1",
                "-i", str(music),
                "-filter_complex", filter_complex,
                "-map", "0:v",
                "-map", "[mix]",
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(output),
            ]
        else:
            filter_complex = f"[1:a]volume={safe_volume:.3f}[bg]"
            cmd = [
                settings.ffmpeg_path,
                "-y",
                "-i", str(video),
                "-stream_loop", "-1",
                "-i", str(music),
                "-filter_complex", filter_complex,
                "-map", "0:v",
                "-map", "[bg]",
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(output),
            ]

        if self._run_ffmpeg(cmd) and output.exists():
            return output
        logger.error("Background music mix failed, keeping video without music")
        return video

    def _has_audio_stream(self, path: Path) -> bool:
        try:
            result = subprocess.run(
                [
                    "ffprobe", "-v", "error",
                    "-select_streams", "a",
                    "-show_entries", "stream=codec_type",
                    "-of", "csv=p=0",
                    str(path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.returncode == 0 and "audio" in result.stdout
        except (OSError, ValueError, subprocess.TimeoutExpired):
            return False

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
            header = path.read_bytes()[:12]
            if header.startswith((b"ID3", b"RIFF", b"OggS", b"fLaC")):
                return True
            if len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0:
                return True
            return header[4:8] == b"ftyp"
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
