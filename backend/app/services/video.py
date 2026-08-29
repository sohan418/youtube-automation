import hashlib
import logging
import os
import re
import shutil
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
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
        self._scene_status: dict[str, dict[int, str]] = {}
        self._convert_lock = threading.Lock()

    def _set_scene_status(self, slug: str, order: int, status: str) -> None:
        if slug not in self._scene_status:
            self._scene_status[slug] = {}
        self._scene_status[slug][order] = status

    def _get_scene_statuses(self, slug: str) -> dict[int, str]:
        return self._scene_status.get(slug, {})

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
            project_path = storage_service.get_project_path(slug)
            final_video_path = project_path / "video" / "final.mp4"
            if final_video_path.exists():
                relative = str(final_video_path.relative_to(storage_service.root.parent))
                return {
                    "running": False,
                    "progress": 100,
                    "stage": "done",
                    "message": "Video is built and ready.",
                    "output": relative,
                    "error": None,
                    "updated_at": None,
                    "scene_statuses": self._get_scene_statuses(slug),
                }
            return {
                "running": False,
                "progress": 0,
                "stage": "idle",
                "message": "No video build in progress.",
                "output": None,
                "error": None,
                "updated_at": None,
                "scene_statuses": self._get_scene_statuses(slug),
            }
        data = dict(self._progress[slug])
        data["scene_statuses"] = self._get_scene_statuses(slug)
        return data

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

    def _sanitize_video(self, video: Path, output: Path) -> bool:
        if not video.exists() or video.stat().st_size < 1024:
            return False
        cmd = [
            settings.ffmpeg_path,
            "-y",
            "-i", str(video),
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            str(output),
        ]
        return self._run_ffmpeg(cmd)

    def _ensure_mp4(self, video: Path) -> Path:
        if video.suffix.lower() != ".webm":
            return video
        candidate = video.with_suffix(".mp4")
        if candidate.exists() and candidate.stat().st_size > 1024:
            return candidate
        converted = video.parent / f"{video.stem}_converted.mp4"
        if converted.exists() and converted.stat().st_size > 1024:
            return converted
        with self._convert_lock:
            if converted.exists() and converted.stat().st_size > 1024:
                return converted
            logger.info("Converting WEBM to MP4: %s -> %s", video.name, converted.name)
            if self._sanitize_video(video, converted):
                if converted.exists() and converted.stat().st_size > 1024:
                    return converted
                logger.error("WEBM conversion produced empty file: %s", converted)
            else:
                logger.error("WEBM conversion failed: %s", video)
        return video

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
        audio_start: float | None = None,
    ) -> None:
        video = self._ensure_mp4(video)
        if not video.exists() or video.stat().st_size < 1024:
            logger.error("Video input missing or empty: %s", video)
            return
        info = self._probe_video_info(video)
        if not info or not info.get("width") or not info.get("height"):
            logger.error("Video has no valid stream: %s (info=%s)", video, info)
            return
        vid_duration = info.get("duration")
        if vid_duration is not None and vid_duration <= 0:
            logger.error("Video has zero/negative duration: %s (%.3fs)", video, vid_duration)
            return
        if vid_duration is not None and start >= vid_duration:
            logger.error("Seek start %.3fs beyond video duration %.3fs: %s", start, vid_duration, video)
            return
        if duration <= 0:
            logger.error("Invalid segment duration %.3f for video %s", duration, video)
            return

        def _render(cmd: list[str]) -> bool:
            result = self._run_ffmpeg_with_result(cmd)
            if result is None:
                return False
            if result.returncode != 0:
                logger.error("FFmpeg error: %s", result.stderr)
                return False
            if not output.exists() or output.stat().st_size < 1024:
                logger.error("FFmpeg produced empty output. cmd=%s stderr=%s", " ".join(cmd[:8]), result.stderr[:500])
                return False
            return True

        width, height = self._parse_resolution(resolution)
        vf = (
            f"scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},setsar=1"
        )
        v_ss = video_start if video_start is not None else start
        if vid_duration is not None:
            available = max(vid_duration - v_ss, 0.0)
            pad_needed = duration - available
            if pad_needed > 0.05:
                factor = min(duration / available, 2.5) if available > 0.1 else 1.0
                vf += f",setpts=PTS*{factor:.4f}"
                leftover = duration - available * factor
                if leftover > 0.05:
                    vf += (
                        ",tpad=stop_mode=clone:"
                        f"stop_duration={leftover + 0.25:.3f}"
                    )
                logger.info(
                    "Video %s: stretching %.3fs -> %.3fs (speed x%.3f%s)",
                    video.name,
                    available,
                    duration,
                    1.0 / factor,
                    "+freeze" if leftover > 0.05 else "",
                )
        base_cmd = [
            settings.ffmpeg_path,
            "-y",
            "-ss", f"{v_ss:.3f}",
            "-t", f"{duration:.3f}",
            "-i", str(video),
        ]
        silent_audio = volume <= 0.001
        if audio is not None and not silent_audio:
            a_ss = audio_start if audio_start is not None else start
            base_cmd += ["-ss", f"{a_ss:.3f}", "-t", f"{duration:.3f}", "-i", str(audio)]
            fade_st = max(duration - 0.5, 0.0)
            base_cmd += [
                "-map", "0:v", "-map", "1:a",
                "-af", f"volume={max(0.001, min(1.0, float(volume))):.3f},apad,afade=t=out:st={fade_st:.3f}:d=0.5",
                "-c:a", "aac", "-b:a", "192k",
            ]
        elif self._has_audio_stream(video) and not silent_audio:
            base_cmd += [
                "-map", "0:v", "-map", "0:a",
                "-af", f"volume={max(0.001, min(1.0, float(volume))):.3f}",
                "-c:a", "aac", "-b:a", "192k",
            ]
        else:
            base_cmd += [
                "-f", "lavfi",
                "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-map", "0:v", "-map", "1:a",
                "-c:a", "aac", "-b:a", "192k",
            ]

        primary_cmd = base_cmd + [
            "-vf", vf,
            "-r", "25",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-t", f"{duration:.3f}",
            str(output),
        ]
        if _render(primary_cmd):
            return

        fallback_cmd = base_cmd + [
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-t", f"{duration:.3f}",
            str(output),
        ]
        if _render(fallback_cmd):
            return

        copy_cmd = base_cmd + [
            "-c", "copy",
            str(output),
        ]
        if _render(copy_cmd):
            return

        logger.error("All FFmpeg attempts failed for video=%s start=%.3f dur=%.3f out=%s", video, v_ss, duration, output)

    def _plans_from_timeline(
        self,
        clips: list[dict],
        scene_map: dict[int, dict],
        project_path: Path,
        track_states: dict | None = None,
    ) -> tuple[list[dict], list[dict], float, list[dict]]:
        ts = track_states or {}
        ts_muted = {
            k: bool((ts.get(k) or {}).get("muted")) for k in ("video", "narration", "music")
        }
        visuals = [c for c in clips if c.get("track") == "video"]
        narrations = [
            c
            for c in clips
            if c.get("track") == "narration"
            and c.get("audio_path")
            and not c.get("muted")
            and not ts_muted["narration"]
        ]
        music_clips = [
            c
            for c in clips
            if c.get("track") == "music"
            and c.get("audio_path")
            and not c.get("muted")
            and not ts_muted["music"]
        ]
        visuals.sort(key=lambda c: float(c.get("start") or 0))

        probed_audio: dict[str, float] = {}

        def _real_audio_dur(p: Path) -> float:
            key = str(p)
            if key not in probed_audio:
                try:
                    d = self._probe_audio_duration(p)
                except Exception:
                    d = None
                probed_audio[key] = float(d) if d and d > 0 else 0.0
            return probed_audio[key]

        plans: list[dict] = []
        narration_events: list[dict] = []
        subtitle_entries: list[dict] = []
        cursor = 0.0
        idx = 0

        for v in visuals:
            tl_start = float(v.get("start") or 0)
            duration = float(v.get("duration") or 0)
            if duration <= 0.05:
                continue
            start = max(tl_start, cursor)
            if start > cursor + 0.049:
                plans.append(
                    {
                        "order": idx,
                        "key": f"g{idx:02d}",
                        "kind": "gap",
                        "media": [],
                        "audio_ok": False,
                        "full_audio": None,
                        "audio_off": 0.0,
                        "duration": round(start - cursor, 3),
                        "motion_effect": "none",
                    }
                )
                idx += 1
                cursor = start

            media: list[dict] = []
            vp = v.get("video_path")
            if vp:
                p = self._resolve_scene_path(vp)
                if p.exists() and self._is_valid_video(p):
                    media.append({"kind": "video", "path": p})
            if not media:
                ip = v.get("image_path")
                if ip:
                    p = self._resolve_scene_path(ip)
                    if p.exists():
                        media.append({"kind": "image", "path": p})
            if not media:
                scene = scene_map.get(v.get("scene_id"))
                if scene:
                    media = self._resolve_scene_media(scene, project_path)
            if not media:
                logger.warning(
                    "Timeline clip %s has no resolvable media — skipped", v.get("id")
                )
                continue

            scene = scene_map.get(v.get("scene_id"))
            narration_text = (scene or {}).get("narration")
            if narration_text:
                subtitle_entries.append(
                    {"start": cursor, "end": cursor + duration, "text": narration_text}
                )

            sig = (
                f"v4|{idx}|{duration:.3f}|{Path(str(media[0]['path'])).name}"
                f"|{float(v.get('volume') if v.get('volume') is not None else 1.0):.2f}"
                f"|{1 if (v.get('muted') or ts_muted['video']) else 0}"
            )
            digest = hashlib.md5(sig.encode()).hexdigest()[:8]
            plans.append(
                {
                    "order": idx,
                    "key": f"c{idx:02d}_{digest}",
                    "kind": "clip",
                    "media": media,
                    "audio_ok": False,
                    "full_audio": None,
                    "audio_off": 0.0,
                    "duration": duration,
                    "volume": max(
                        0.0,
                        min(1.0, float(v.get("volume") if v.get("volume") is not None else 1.0)),
                    ),
                    "mute_audio": bool(v.get("muted") or ts_muted["video"]),
                    "timeline_start": round(tl_start, 3),
                    "render_start": round(start, 3),
                    "motion_effect": (v.get("motion_effect") or (scene or {}).get("motion_effect") or "none")
                    if isinstance(scene, dict) or scene is None
                    else "none",
                }
            )
            idx += 1
            cursor = start + duration

        for n in narrations:
            ap = self._resolve_scene_path(n["audio_path"])
            if not ap.exists() or not self._is_valid_audio(ap):
                continue
            real = _real_audio_dur(ap)
            if real <= 0:
                continue
            ns = float(n.get("start") or 0)
            n_in = float(n.get("audio_in") or 0)
            off = min(max(n_in, 0.0), max(real - 0.05, 0.0))
            narration_events.append(
                {
                    "pos": round(max(ns, 0.0), 3),
                    "path": str(ap),
                    "offset": round(off, 3),
                    "volume": float(n.get("volume") if n.get("volume") is not None else 1.0),
                    "fade_in": float(n.get("fade_in") or 0),
                    "fade_out": float(n.get("fade_out") or 0),
                    "dur": round(max(real - off, 0.0), 3),
                    "src": "voice",
                }
            )
        for m in music_clips:
            ap = self._resolve_scene_path(m["audio_path"])
            if not ap.exists() or not self._is_valid_audio(ap):
                continue
            real = _real_audio_dur(ap)
            if real <= 0:
                continue
            ms = float(m.get("start") or 0)
            m_in = float(m.get("audio_in") or 0)
            off = min(max(m_in, 0.0), max(real - 0.05, 0.0))
            vol = float(m.get("volume") if m.get("volume") is not None else 0.5)
            narration_events.append(
                {
                    "pos": round(max(ms, 0.0), 3),
                    "path": str(ap),
                    "offset": round(off, 3),
                    "volume": max(0.0, min(2.0, vol)),
                    "fade_in": float(m.get("fade_in") or 0),
                    "fade_out": float(m.get("fade_out") or 2.0),
                    "dur": round(max(real - off, 0.0), 3),
                    "src": "music",
                }
            )
        narration_events.sort(key=lambda e: e["pos"])

        total_time = cursor
        for e in narration_events:
            if e.get("src") == "voice":
                total_time = max(total_time, float(e["pos"]) + float(e["dur"]))

        tail = total_time - cursor
        if tail > 0.05 and plans:
            last_clip = None
            for p in reversed(plans):
                if p["kind"] == "clip":
                    last_clip = p
                    break
            if last_clip is not None:
                logger.info(
                    "Padding final clip %s by %.3fs to cover trailing audio",
                    last_clip["key"], tail,
                )
                last_clip["duration"] = round(last_clip["duration"] + tail, 3)

        return plans, subtitle_entries, total_time, narration_events

    def _create_black_segment(
        self, duration: float, output: Path, resolution: str
    ) -> bool:
        width, height = self._parse_resolution(resolution)
        cmd = [
            settings.ffmpeg_path,
            "-y",
            "-f", "lavfi",
            "-i", f"color=c=black:s={width}x{height}:r=25",
            "-f", "lavfi",
            "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-t", f"{duration:.3f}",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(output),
        ]
        return self._run_ffmpeg(cmd)

    def build_video(
        self,
        slug: str,
        scenes: list[dict],
        background_music: str | None = None,
        music_volume: float = 0.12,
        ratio: str = "16:9",
        resolution: str | None = None,
        subtitles: bool = False,
        subtitle_style: str = "default",
        subtitle_position: str = "bottom",
        subtitle_color: str = "#FFFF00",
        subtitle_outline_color: str = "#000000",
        subtitle_outline: float = 2.0,
        subtitle_font_size: int | None = None,
        force_rebuild: bool = False,
        timeline_clips: list[dict] | None = None,
        track_states: dict | None = None,
        logo_overlay: bool = False,
    ) -> str:
        resolution = self.resolve_resolution(ratio, resolution)
        project_path = storage_service.get_project_path(slug)
        video_dir = project_path / "video"
        video_dir.mkdir(exist_ok=True)

        concat_file = video_dir / "concat_list.txt"
        output_path = video_dir / "final.mp4"

        if force_rebuild:
            logger.info("Force rebuild requested — removing existing segments and output")
            for old in video_dir.glob("segment_*.mp4"):
                try:
                    old.unlink()
                except OSError:
                    pass
            for old in video_dir.glob("scene_*_media*.mp4"):
                try:
                    old.unlink()
                except OSError:
                    pass
            try:
                output_path.unlink(missing_ok=True)
            except PermissionError:
                unlocked = False
                import time as _time
                for _ in range(6):
                    _time.sleep(0.5)
                    try:
                        output_path.unlink(missing_ok=True)
                        unlocked = True
                        break
                    except PermissionError:
                        continue
                if not unlocked:
                    alt = video_dir / f"final_{int(_time.time())}.mp4"
                    logger.warning(
                        "final.mp4 is locked (open in a player?) - writing to %s instead",
                        alt.name,
                    )
                    output_path = alt

        self.set_progress(slug, 1, "preparing", "Preparing video scenes...")
        plans: list[dict] = []
        subtitle_entries = []
        current_time = 0.0
        narration_events: list[dict] = []
        if timeline_clips:
            scene_map = {d.get("id"): d for d in scenes if isinstance(d, dict)}
            plans, subtitle_entries, current_time, narration_events = (
                self._plans_from_timeline(timeline_clips, scene_map, project_path, track_states)
            )
        else:
            for scene in sorted(scenes, key=lambda s: s["order_index"]):
                order = scene["order_index"]
                duration = scene.get("duration_seconds") or 5.0

                media = self._resolve_scene_media(scene, project_path)
                if not media:
                    logger.warning("Scene %d has no resolvable media — skipping", order)
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

                narration = scene.get("narration")
                if narration:
                    subtitle_entries.append({
                        "start": current_time,
                        "end": current_time + duration,
                        "text": narration
                    })

                plans.append(
                    {
                        "order": order,
                        "key": f"{order:03d}",
                        "kind": "clip",
                        "media": media,
                        "audio_ok": audio_ok,
                        "full_audio": full_audio,
                        "audio_off": 0.0,
                        "duration": duration,
                        "motion_effect": scene.get("motion_effect") or "none",
                    }
                )
                current_time += duration

        if not plans:
            return self._create_placeholder_video(slug, resolution)

        segment_files: list[Path] = []
        rendered_orders: set[int] = set()
        build_errors: list[str] = []

        def _segment_path(plan: dict) -> Path:
            return video_dir / f"segment_{plan['key']}.mp4"

        def _needs_render(plan: dict) -> bool:
            seg = _segment_path(plan)
            if not seg.exists():
                return True
            if seg.stat().st_size < 1024:
                return True
            return False

        total_to_render = sum(1 for p in plans if _needs_render(p))
        if total_to_render == 0:
            logger.info("All scene segments already exist — skipping render")
            for plan in plans:
                seg = _segment_path(plan)
                if seg.exists():
                    segment_files.append(seg)
            segment_files.sort()
        else:
            total_images = max(sum(len(p.get("media") or []) for p in plans), 1)
            done_images = 0
            done_lock = threading.Lock()

            def _build_one(plan: dict) -> Path | None:
                nonlocal done_images
                order = plan["order"]
                duration = plan["duration"]
                media = plan.get("media") or []
                audio_ok = plan["audio_ok"]
                full_audio = plan["full_audio"]
                audio_off = float(plan.get("audio_off") or 0.0)
                motion_effect = plan.get("motion_effect", "none")
                segment = _segment_path(plan)

                if not _needs_render(plan):
                    logger.info("Plan %s segment already exists — skipping render", plan["key"])
                    self._set_scene_status(slug, order, "done")
                    return segment

                if plan.get("kind") == "gap":
                    self._set_scene_status(slug, order, "rendering")
                    ok = self._create_black_segment(duration, segment, resolution)
                    self._set_scene_status(slug, order, "done" if ok else "failed")
                    with done_lock:
                        done_images += 1
                        done_local = done_images
                    self.set_progress(
                        slug,
                        int(2 + 88 * done_local / total_images),
                        "rendering",
                        f"Filling gap {done_local}/{total_images}...",
                    )
                    if segment.exists() and segment.stat().st_size > 1024:
                        return segment
                    build_errors.append(f"Gap {order}")
                    return None

                self._set_scene_status(slug, order, "rendering")
                try:
                    if len(media) == 1:
                        item = media[0]
                        with done_lock:
                            done_images += 1
                            done_local = done_images
                        label = "video clip" if item["kind"] == "video" else "image"
                        self.set_progress(
                            slug,
                            int(2 + 88 * done_local / total_images),
                            "rendering",
                            f"Rendering scene {order} {label} ({done_local}/{total_images} media)...",
                        )
                        if item["kind"] == "video":
                            self._create_video_segment(
                                item["path"], full_audio if audio_ok else None,
                                0, duration, segment, resolution,
                                volume=0.0 if plan.get("mute_audio") else float(plan.get("volume", 1.0)),
                                audio_start=audio_off if audio_ok else None,
                            )
                        elif audio_ok:
                            self._create_segment_with_audio_slice(
                                item["path"], full_audio, audio_off, duration,
                                segment, resolution, motion_effect,
                            )
                        else:
                            self._create_segment_silent(item["path"], segment, duration, resolution, motion_effect)
                    else:
                        sub_segments: list[Path] = []
                        audio_len = self._probe_audio_duration(full_audio) if audio_ok else None

                        video_durations: dict[int, float] = {}
                        for k, item in enumerate(media):
                            if item["kind"] == "video":
                                probed = self._probe_audio_duration(item["path"]) or (
                                    self._probe_video_info(item["path"]) or {}
                                ).get("duration") or 0.0
                                video_durations[k] = max(probed, 0.5)

                        total_video_time = sum(video_durations.values())
                        image_indices = [k for k in range(len(media)) if k not in video_durations]
                        remaining = max(duration - total_video_time, 0.0)
                        image_part = max((remaining / len(image_indices)) if image_indices else 0.0, 0.5)

                        item_durations = [
                            video_durations.get(k, image_part) for k in range(len(media))
                        ]

                        cur = 0.0
                        for k, item in enumerate(media):
                            seg = video_dir / f"scene_{order:03d}_media{k:02d}.mp4"
                            part = item_durations[k]
                            has_audio = audio_ok and (audio_len is None or cur < audio_len)
                            if item["kind"] == "video":
                                self._create_video_segment(
                                    item["path"], full_audio if has_audio else None,
                                    cur, part, seg, resolution,
                                    volume=0.0 if plan.get("mute_audio") else float(plan.get("volume", 1.0)),
                                    video_start=0.0,
                                )
                            elif has_audio:
                                self._create_segment_with_audio_slice(
                                    item["path"], full_audio, cur, part, seg, resolution, motion_effect
                                )
                            else:
                                self._create_segment_silent(item["path"], seg, part, resolution, motion_effect)
                            if seg.exists() and seg.stat().st_size > 1024:
                                sub_segments.append(seg)
                            else:
                                logger.warning("Scene %d media %d segment failed (kind=%s)", order, k, item["kind"])
                            cur += part

                        if sub_segments:
                            self._concat_list(sub_segments, segment, reencode=True)

                    if segment.exists():
                        rendered_orders.add(order)
                        self._set_scene_status(slug, order, "done")
                        return segment
                    self._set_scene_status(slug, order, "failed")
                    return None
                except Exception:
                    logger.exception("Scene %d render failed", order)
                    self._set_scene_status(slug, order, "failed")
                    build_errors.append(f"Scene {order}")
                    return None

            max_workers = min(total_to_render, settings.ffmpeg_max_workers or 1)
            self.set_progress(slug, 2, "rendering", f"Rendering {total_to_render} scenes ({max_workers} workers)...")

            if max_workers > 1:
                with ThreadPoolExecutor(max_workers=max_workers) as pool:
                    futures = {pool.submit(_build_one, p): p for p in plans}
                    for future in as_completed(futures):
                        try:
                            result = future.result()
                            if result:
                                segment_files.append(result)
                        except Exception:
                            logger.exception("Scene segment failed")
            else:
                for plan in plans:
                    result = _build_one(plan)
                    if result:
                        segment_files.append(result)

        segment_files.sort()
        if not segment_files:
            err = "No scene segments produced"
            if build_errors:
                err += f" (failures: {', '.join(build_errors)})"
            logger.error(err)
            self.set_progress(slug, 100, "failed", err)
            for old in video_dir.glob("scene_*_media*.mp4"):
                try:
                    old.unlink()
                except OSError:
                    pass
            return ""

        self.set_progress(slug, 92, "joining", "Joining all scene segments...")
        with concat_file.open("w", encoding="utf-8") as f:
            for seg in segment_files:
                f.write(f"file '{seg.as_posix()}'\n")

        output_path = video_dir / "final.mp4"

        # Resolve music & subtitles before concat so we can do ONE combined pass
        music_path: Path | None = None
        if background_music:
            candidate = self._resolve_scene_path(background_music)
            if candidate.exists():
                music_path = candidate
        if timeline_clips and any(
            e.get("src") == "music" for e in narration_events
        ):
            if music_path:
                logger.info(
                    "Timeline has music clips — ignoring project background music"
                )
            music_path = None

        ass_path: Path | None = None
        if subtitles and subtitle_entries:
            ass_path = video_dir / "subtitles.ass"
            self._generate_ass_subtitles(
                subtitle_entries, ass_path, style=subtitle_style,
                position=subtitle_position, color=subtitle_color,
                outline_color=subtitle_outline_color, outline_thickness=subtitle_outline,
                font_size=subtitle_font_size, resolution=resolution,
            )
            if not ass_path.exists():
                ass_path = None

        # Single combined FFmpeg pass: concat + narrations + music + subtitles in one re-encode
        needs_combined = music_path or ass_path or narration_events
        if needs_combined:
            stage_msg = (
                "Joining with voice, music & subtitles..."
                if music_path and ass_path and narration_events
                else ("Joining audio & subtitles..." if music_path or narration_events
                      else "Joining & burning subtitles...")
            )
            if music_path and ass_path and not narration_events:
                stage_msg = "Joining with music & subtitles..."
            elif ass_path and not (music_path or narration_events):
                stage_msg = "Joining & burning subtitles..."
            elif music_path and not ass_path and not narration_events:
                stage_msg = "Joining with background music..."
            self.set_progress(slug, 93, "joining", stage_msg)
            ok = self._concat_with_extras(
                concat_file, output_path, music_path, music_volume, ass_path,
                narration_events=narration_events, total_duration=current_time,
            )
            if not ok or not output_path.exists():
                logger.error("Combined concat failed — attempting separate subtitle/music passes")
                self._concat_segments(concat_file, output_path, reencode=False)
                if output_path.exists():
                    if narration_events:
                        self._overlay_narrations(output_path, narration_events, current_time)
                    if music_path:
                        self._add_background_music(output_path, music_path, video_dir, music_volume)
                    if ass_path:
                        subtitled = video_dir / "final_subtitled.mp4"
                        self._burn_subtitles(output_path, ass_path, subtitled)
                        if subtitled.exists():
                            output_path.unlink(missing_ok=True)
                            subtitled.rename(output_path)
        else:
            self._concat_segments(concat_file, output_path, reencode=False)

        # Optional: burn semi-transparent channel logo watermark (bottom-right)
        if logo_overlay and output_path.exists():
            self.set_progress(slug, 96, "joining", "Overlaying channel logo...")
            logo = self._get_branding_logo(slug)
            if logo and logo.exists() and logo.stat().st_size > 0:
                watermarked = video_dir / "final_watermarked.mp4"
                if self._overlay_logo(output_path, logo, watermarked) and watermarked.exists():
                    try:
                        output_path.unlink(missing_ok=True)
                    except OSError:
                        pass
                    watermarked.rename(output_path)
            else:
                logger.warning("Logo overlay enabled but channel logo unavailable — skipping")

        relative = str(output_path.relative_to(storage_service.root.parent))
        self.set_progress(
            slug, 100, "done", "Video built successfully", running=False, output=relative
        )
        return relative

    @staticmethod
    def _split_into_word_chunks(text: str, max_words: int = 4) -> list[str]:
        words = text.split()
        if not words:
            return []
        chunks = []
        for i in range(0, len(words), max_words):
            chunks.append(" ".join(words[i : i + max_words]))
        return chunks

    @staticmethod
    def _hex_to_ass_color(hex_color: str) -> str:
        h = hex_color.lstrip("#")
        if len(h) == 3:
            h = h[0] * 2 + h[1] * 2 + h[2] * 2
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return f"&H00{b:02X}{g:02X}{r:02X}"

    @staticmethod
    def _position_to_alignment(position: str, is_vertical: bool) -> int:
        mapping = {
            "top": 8,
            "center": 5,
            "bottom": 2,
        }
        return mapping.get(position, 2)

    def _generate_ass_subtitles(
        self,
        subtitle_entries: list[dict],
        output_path: Path,
        style: str = "default",
        resolution: str | None = None,
        position: str = "bottom",
        color: str = "#FFFF00",
        outline_color: str = "#000000",
        outline_thickness: float = 2.0,
        font_size: int | None = None,
    ) -> None:
        width, height = 1920, 1080
        if resolution:
            try:
                w_s, h_s = resolution.split("x")
                width, height = int(w_s), int(h_s)
            except Exception:
                pass

        is_vertical = height > width
        alignment = self._position_to_alignment(position, is_vertical)
        primary_colour = self._hex_to_ass_color(color)
        outline_colour = self._hex_to_ass_color(outline_color)

        style_lines = []
        if style == "shorts":
            auto_size = int(height * 0.032) if is_vertical else int(height * 0.045)
            fs = font_size if font_size is not None else auto_size
            margin_v = int(height * 0.12) if position == "bottom" else int(height * 0.04)
            style_lines.append(f"Style: Default,Impact,{fs},{primary_colour},&H000000FF,{outline_colour},&H00000000,-1,0,0,0,100,100,0,0,1,{max(outline_thickness, 3.5):.1f},0,{alignment},20,20,{margin_v},1")
        elif style == "classic":
            auto_size = int(height * 0.024) if is_vertical else int(height * 0.035)
            fs = font_size if font_size is not None else auto_size
            margin_v = int(height * 0.08) if position == "bottom" else int(height * 0.04)
            style_lines.append(f"Style: Default,Arial,{fs},{primary_colour},&H000000FF,{outline_colour},&H00000000,0,0,0,0,100,100,0,0,1,{max(outline_thickness, 1.8):.1f},1,{alignment},20,20,{margin_v},1")
        else:
            auto_size = int(height * 0.026) if is_vertical else int(height * 0.038)
            fs = font_size if font_size is not None else auto_size
            margin_v = int(height * 0.08) if position == "bottom" else int(height * 0.04)
            style_lines.append(f"Style: Default,Arial,{fs},{primary_colour},&H000000FF,{outline_colour},&H00000000,-1,0,0,0,100,100,0,0,1,{max(outline_thickness, 2.0):.1f},1,{alignment},20,20,{margin_v},1")

        header = f"""[Script Info]
Title: Auto-Generated Subtitles
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{"".join(style_lines)}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        def format_ass_time(sec: float) -> str:
            if sec < 0:
                sec = 0.0
            h = int(sec // 3600)
            m = int((sec % 3600) // 60)
            s = int(sec % 60)
            c = int(round((sec - int(sec)) * 100))
            if c >= 100:
                s += 1
                c = 0
            if s >= 60:
                m += 1
                s = 0
            if m >= 60:
                h += 1
                m = 0
            return f"{h}:{m:02d}:{s:02d}.{c:02d}"

        def _escape_ass_text(text: str) -> str:
            return (
                text.replace("\\", "\\\\")
                .replace("{", "\\{")
                .replace("}", "\\}")
                .replace("\n", " ")
                .replace("\r", " ")
            )

        is_word_by_word = True
        with output_path.open("w", encoding="utf-8") as f:
            f.write(header)
            for entry in subtitle_entries:
                text = _escape_ass_text(entry["text"]).strip()
                if not text:
                    continue
                if is_word_by_word:
                    chunks = self._split_into_word_chunks(text)
                    total_words = len(text.split())
                    entry_duration = entry["end"] - entry["start"]
                    padding = min(0.05, entry_duration * 0.05) if entry_duration >= 0.3 else 0.0
                    cursor = entry["start"] + padding
                    end_time = entry["end"] - padding if entry_duration >= 0.3 else entry["end"]
                    available = max(end_time - cursor, 0.01)
                    for idx, chunk in enumerate(chunks):
                        chunk_words = len(chunk.split())
                        if idx == len(chunks) - 1:
                            chunk_end = end_time
                        else:
                            chunk_duration = (chunk_words / total_words) * available if total_words else available / len(chunks)
                            chunk_end = cursor + chunk_duration
                        if chunk_end > end_time:
                            chunk_end = end_time
                        if chunk_end < cursor:
                            chunk_end = cursor + 0.01
                        f.write(
                            f"Dialogue: 0,{format_ass_time(cursor)},{format_ass_time(chunk_end)},Default,,0,0,0,,{chunk}\n"
                        )
                        cursor = chunk_end
                else:
                    start_str = format_ass_time(entry["start"])
                    end_str = format_ass_time(entry["end"])
                    f.write(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text}\n")

    def _burn_subtitles(self, input_video: Path, ass_path: Path, output_video: Path) -> None:
        escaped_path = ass_path.as_posix().replace(":", "\\:")
        cmd = [
            settings.ffmpeg_path,
            "-y",
            "-i", str(input_video),
            "-vf", f"ass='{escaped_path}'",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-c:a", "copy",
            str(output_video),
        ]
        self._run_ffmpeg(cmd)

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

    def _get_motion_filter(self, motion_effect: str, width: int, height: int, duration: float) -> str:
        frames = max(int(25 * duration), 1)
        if motion_effect == "none":
            return f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1"
        factor = 4 if max(width, height) <= 1920 else 2
        up_w = width * factor
        up_h = height * factor
        base = f"scale={up_w}:{up_h}:force_original_aspect_ratio=increase,crop={up_w}:{up_h}"
        tail = f"d={frames}:s={width}x{height}:fps=25"
        center = "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        if motion_effect == "zoom_in":
            return f"{base},zoompan=z='min(1+0.25*on/{frames},1.25)':{center}:{tail},setsar=1"
        elif motion_effect == "zoom_out":
            return f"{base},zoompan=z='max(1.25-0.25*on/{frames},1.0)':{center}:{tail},setsar=1"
        elif motion_effect == "pan_right":
            return f"{base},zoompan=z=1.15:x='(iw-iw/zoom)*(on/{frames})':y='(ih-ih/zoom)/2':{tail},setsar=1"
        elif motion_effect == "pan_left":
            return f"{base},zoompan=z=1.15:x='(iw-iw/zoom)*(1-on/{frames})':y='(ih-ih/zoom)/2':{tail},setsar=1"
        elif motion_effect == "pan_up":
            return f"{base},zoompan=z=1.15:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*(1-on/{frames})':{tail},setsar=1"
        elif motion_effect == "pan_down":
            return f"{base},zoompan=z=1.15:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*(on/{frames})':{tail},setsar=1"
        else:
            return f"{base},setsar=1"

    def _create_segment_with_audio(
        self,
        image: Path,
        audio: Path,
        output: Path,
        resolution: str,
        motion_effect: str = "none",
        duration: float | None = None,
    ) -> None:
        if not duration or duration <= 0:
            duration = self._probe_audio_duration(audio) or 5.0
        fade_st = max(duration - 0.5, 0.0)
        af = f"apad,afade=t=out:st={fade_st:.3f}:d=0.5"
        width, height = self._parse_resolution(resolution)

        if motion_effect != "none":
            vf = self._get_motion_filter(motion_effect, width, height, duration)
            cmd = [
                settings.ffmpeg_path,
                "-y",
                "-loop", "1",
                "-i", str(image),
                "-i", str(audio),
                "-vf", vf,
                "-af", af,
                "-t", f"{duration:.3f}",
                "-r", "25",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "192k",
                str(output),
            ]
        else:
            cmd = [
                settings.ffmpeg_path,
                "-y",
                "-loop", "1",
                "-i", str(image),
                "-i", str(audio),
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "stillimage",
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-s", resolution,
                "-af", af,
                "-t", f"{duration:.3f}",
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
        motion_effect: str = "none",
    ) -> None:
        width, height = self._parse_resolution(resolution)
        fade_st = max(duration - 0.5, 0.0)
        af = f"apad,afade=t=out:st={fade_st:.3f}:d=0.5"

        if motion_effect != "none":
            vf = self._get_motion_filter(motion_effect, width, height, duration)

            cmd = [
                settings.ffmpeg_path,
                "-y",
                "-loop", "1",
                "-i", str(image),
                "-ss", f"{start:.3f}",
                "-t", f"{duration:.3f}",
                "-i", str(audio),
                "-vf", vf,
                "-af", af,
                "-r", "25",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-t", f"{duration:.3f}",
                str(output),
            ]
        else:
            cmd = [
                settings.ffmpeg_path,
                "-y",
                "-loop", "1",
                "-i", str(image),
                "-ss", f"{start:.3f}",
                "-t", f"{duration:.3f}",
                "-i", str(audio),
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "stillimage",
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-s", resolution,
                "-af", af,
                "-t", f"{duration:.3f}",
                str(output),
            ]
        self._run_ffmpeg(cmd)

    def _create_segment_silent(
        self, image: Path, output: Path, duration: float, resolution: str, motion_effect: str = "none"
    ) -> None:
        width, height = self._parse_resolution(resolution)
        
        if motion_effect != "none":
            vf = self._get_motion_filter(motion_effect, width, height, duration)

            cmd = [
                settings.ffmpeg_path,
                "-y",
                "-loop", "1",
                "-i", str(image),
                "-f", "lavfi",
                "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-map", "0:v", "-map", "1:a",
                "-vf", vf,
                "-r", "25",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-t", f"{duration:.3f}",
                str(output),
            ]
        else:
            cmd = [
                settings.ffmpeg_path,
                "-y",
                "-loop", "1",
                "-i", str(image),
                "-f", "lavfi",
                "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                "-map", "0:v", "-map", "1:a",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "stillimage",
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-s", resolution,
                "-t", str(duration),
                str(output),
            ]
        self._run_ffmpeg(cmd)

    def _concat_segments(self, concat_file: Path, output: Path, reencode: bool = False) -> bool:
        cmd = [
            settings.ffmpeg_path,
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_file),
        ]
        if reencode:
            cmd += ["-c:v", "libx264", "-r", "25", "-c:a", "aac", "-pix_fmt", "yuv420p", "-b:a", "192k"]
        else:
            cmd += ["-c", "copy"]
        cmd.append(str(output))
        ok = self._run_ffmpeg(cmd)
        if not ok:
            logger.error("Concat failed for %s (reencode=%s)", output.name, reencode)
        return ok

    def _concat_list(self, segments: list[Path], output: Path, reencode: bool = False) -> None:
        valid = [seg for seg in segments if seg.exists() and seg.stat().st_size > 1024]
        if not valid:
            logger.error("No valid segments to concat for %s", output.name)
            return
        if len(valid) < len(segments):
            logger.warning("Skipping %d empty/invalid segments for %s", len(segments) - len(valid), output.name)
        lines = "\n".join(f"file '{seg.as_posix()}'" for seg in valid)
        concat_file = output.parent / f"concat_{output.stem}.txt"
        try:
            concat_file.write_text(lines, encoding="utf-8")
            self._concat_segments(concat_file, output, reencode=reencode)
        finally:
            try:
                concat_file.unlink(missing_ok=True)
            except OSError:
                pass

    def _concat_with_extras(
        self,
        concat_file: Path,
        output: Path,
        music_path: Path | None,
        music_volume: float,
        ass_path: Path | None,
        narration_events: list[dict] | None = None,
        total_duration: float | None = None,
    ) -> bool:
        """Concat all segments and optionally mix narrations, music + burn subtitles in one pass."""
        events = narration_events or []
        kept: list[dict] = []
        for ev in events:
            raw_vol = ev.get("volume")
            vol = max(0.0, min(2.0, float(raw_vol) if raw_vol is not None else 1.0))
            if vol <= 0.001:
                continue
            ev = dict(ev)
            ev["volume"] = vol
            kept.append(ev)
        events = kept
        has_music = music_path is not None
        has_subs = ass_path is not None
        safe_volume = max(0.01, min(1.0, float(music_volume)))

        cmd = [
            settings.ffmpeg_path, "-y",
            "-f", "concat", "-safe", "0", "-i", str(concat_file),
        ]
        for ev in events:
            cmd += ["-i", str(ev.get("path"))]
        if has_music:
            cmd += ["-stream_loop", "-1", "-i", str(music_path)]

        has_video_audio = self._has_audio_stream_from_concat(concat_file)
        music_idx = 1 + len(events)

        chains: list[str] = []
        vmap = "0:v"
        if has_subs:
            escaped = ass_path.as_posix().replace(":", "\\:")
            chains.append(f"[0:v]ass='{escaped}'[vout]")
            vmap = "[vout]"

        nar_label = None
        if events:
            labels = []
            for j, ev in enumerate(events):
                d = float(ev.get("dur") or 0)
                off = float(ev.get("offset") or 0)
                vol = max(0.0, min(2.0, float(ev.get("volume") or 0.0)))
                ch = f"[{1 + j}:a]atrim=start={off:.3f},asetpts=PTS-STARTPTS"
                if abs(vol - 1.0) > 1e-3:
                    ch += f",volume={vol:.3f}"
                fi = min(max(float(ev.get("fade_in") or 0), 0.0), d)
                fo = min(max(float(ev.get("fade_out") or 0), 0.0), d)
                if fi > 0.01:
                    ch += f",afade=t=in:st=0:d={fi:.3f}"
                if fo > 0.01 and d - fo > 0:
                    ch += f",afade=t=out:st={d - fo:.3f}:d={fo:.3f}"
                ms = int(round(float(ev.get("pos") or 0) * 1000))
                ch += f",adelay={ms}|{ms}[e{j}]"
                labels.append(f"[e{j}]")
                chains.append(ch)
            if labels:
                if len(labels) == 1:
                    nar_label = labels[0]
                else:
                    chains.append(
                        "".join(labels)
                        + f"amix=inputs={len(labels)}:normalize=0[nar]"
                    )
                    nar_label = "[nar]"

        tail = ""
        if total_duration and total_duration > 0:
            tail = f",apad,atrim=0:{float(total_duration):.3f}"

        if nar_label is not None:
            sources = [nar_label]
            if has_video_audio:
                sources.append("[0:a]")
            if has_music:
                chains.append(f"[{music_idx}:a]volume={safe_volume:.3f}[bgm]")
                sources.append("[bgm]")
            if len(sources) == 1:
                chains.append(f"{sources[0]}anull{tail}[mix]")
            else:
                chains.append(
                    "".join(sources)
                    + f"amix=inputs={len(sources)}:duration=longest:normalize=0{tail}[mix]"
                )
            fc = ";".join(chains)
            cmd += [
                "-filter_complex", fc,
                "-map", vmap, "-map", "[mix]",
                "-c:v", "libx264" if has_subs else "copy",
            ]
            if has_subs:
                cmd += ["-preset", "ultrafast", "-crf", "23"]
            cmd += ["-c:a", "aac", "-b:a", "192k", str(output)]
            return self._run_ffmpeg(cmd)

        if has_music and has_subs:
            escaped = ass_path.as_posix().replace(":", "\\:")
            if has_video_audio:
                fc = (
                    f"[0:v]ass='{escaped}'[vout];"
                    f"[1:a]volume={safe_volume:.3f}[bg];"
                    f"[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[mix]"
                )
                cmd += [
                    "-filter_complex", fc,
                    "-map", "[vout]", "-map", "[mix]",
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                    "-c:a", "aac", "-b:a", "192k",
                ]
            else:
                fc = (
                    f"[0:v]ass='{escaped}'[vout];"
                    f"[1:a]volume={safe_volume:.3f}[bg]"
                )
                cmd += [
                    "-filter_complex", fc,
                    "-map", "[vout]", "-map", "[bg]",
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                    "-c:a", "aac", "-b:a", "192k",
                ]
        elif has_subs:
            escaped = ass_path.as_posix().replace(":", "\\:")
            cmd += [
                "-vf", f"ass='{escaped}'",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                "-c:a", "aac", "-b:a", "192k",
            ]
        elif has_music:
            if has_video_audio:
                fc = (
                    f"[1:a]volume={safe_volume:.3f}[bg];"
                    f"[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[mix]"
                )
                cmd += [
                    "-filter_complex", fc,
                    "-map", "0:v", "-map", "[mix]",
                    "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k",
                ]
            else:
                fc = f"[1:a]volume={safe_volume:.3f}[bg]"
                cmd += [
                    "-filter_complex", fc,
                    "-map", "0:v", "-map", "[bg]",
                    "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k",
                ]
        else:
            cmd += ["-c", "copy"]

        cmd += ["-shortest", str(output)]
        return self._run_ffmpeg(cmd)

    def _overlay_logo(self, input_video: Path, logo: Path, output_video: Path) -> bool:
        """Overlay a semi-transparent logo in the bottom-right corner of the video."""
        cmd = [
            settings.ffmpeg_path, "-y",
            "-i", str(input_video),
            "-i", str(logo),
            "-filter_complex",
            "[1:v]scale='min(ih*0.12\\,iw)':-2[logo];"
            "[0:v][logo]overlay=W-w-30:H-h-30:format=auto:enable='gte(t,0)'[vx];"
            "[vx]format=yuv420p,colorchannelmixer=aa=0.85[v]",
            "-map", "[v]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-c:a", "copy", "-movflags", "+faststart",
            str(output_video),
        ]
        ok = self._run_ffmpeg(cmd)
        if not ok:
            logger.error("Logo overlay failed -> %s", output_video.name)
        return ok and output_video.exists() and output_video.stat().st_size > 1024

    def _get_branding_logo(self, slug: str) -> Path | None:
        from app.services.youtube import youtube_service

        return youtube_service.get_channel_logo_path(slug)

    def _overlay_narrations(
        self, video: Path, events: list[dict], total_duration: float | None
    ) -> None:
        tmp_list = video.parent / "concat_overlay.txt"
        try:
            tmp_list.write_text(f"file '{video.as_posix()}'\n", encoding="utf-8")
            out = video.parent / "final_narr.mp4"
            ok = self._concat_with_extras(
                tmp_list, out, None, 0.12, None,
                narration_events=events, total_duration=total_duration,
            )
            if ok and out.exists() and out.stat().st_size > 1024:
                try:
                    video.unlink(missing_ok=True)
                    out.replace(video)
                    logger.info("Narration overlay fallback applied -> %s", video.name)
                except (PermissionError, OSError) as e:
                    logger.warning(
                        "Could not replace %s (locked/open?). Keeping it. %s",
                        video.name, e,
                    )
                finally:
                    out.unlink(missing_ok=True)
        finally:
            tmp_list.unlink(missing_ok=True)

    def _has_audio_stream_from_concat(self, concat_file: Path) -> bool:
        """Check if first segment in concat list has an audio stream."""
        try:
            with open(concat_file) as f:
                first_line = f.readline().strip()
            if first_line.startswith("file "):
                seg_path = first_line.split("file ", 1)[1].strip("'\"")
                return self._has_audio_stream(Path(seg_path))
        except Exception:
            pass
        return True  # assume yes to be safe

    def _add_music_and_subtitles(
        self,
        input_video: Path,
        video_dir: Path,
        music_path: Path | None,
        music_volume: float,
        ass_path: Path | None,
    ) -> None:
        """Single FFmpeg pass that optionally mixes background music and/or burns
        ASS subtitles.  The result always replaces *input_video* (final.mp4).
        Any leftover final_with_music.mp4 / final_subtitled.mp4 temp files are
        cleaned up at the end.
        """
        safe_volume = max(0.01, min(1.0, float(music_volume)))
        has_music = music_path is not None
        has_subs = ass_path is not None
        has_video_audio = self._has_audio_stream(input_video)

        # Build inputs
        cmd = [settings.ffmpeg_path, "-y", "-i", str(input_video)]
        if has_music:
            cmd += ["-stream_loop", "-1", "-i", str(music_path)]

        # When music is present we must use -filter_complex for audio.
        # If subtitles are also present we include the ass filter inside the
        # same filter_complex so that -vf and -filter_complex are never mixed
        # (FFmpeg does not allow both in the same command).
        music_idx = 1 if has_music else None

        if has_music:
            escaped = ass_path.as_posix().replace(":", "\\:") if has_subs else None

            if has_video_audio:
                audio_part = (
                    f"[{music_idx}:a]volume={safe_volume:.3f}[bg];"
                    f"[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[mix]"
                )
                audio_map = "[mix]"
            else:
                audio_part = f"[{music_idx}:a]volume={safe_volume:.3f}[bg]"
                audio_map = "[bg]"

            if has_subs:
                # chain: [0:v] -> ass filter -> [vout], plus audio mix
                fc = f"[0:v]ass='{escaped}'[vout];{audio_part}"
                cmd += [
                    "-filter_complex", fc,
                    "-map", "[vout]", "-map", audio_map,
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                    "-c:a", "aac", "-b:a", "192k",
                ]
            else:
                cmd += [
                    "-filter_complex", audio_part,
                    "-map", "0:v", "-map", audio_map,
                    "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k",
                ]
        else:
            # No music: subtitles only (caller already guards against neither case)
            if has_subs:
                escaped = ass_path.as_posix().replace(":", "\\:")
                cmd += [
                    "-vf", f"ass='{escaped}'",
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                    "-c:a", "copy",
                ]
            else:
                cmd += ["-c:v", "copy", "-c:a", "copy"]

        tmp_output = video_dir / "final_combined_tmp.mp4"
        cmd += ["-shortest", str(tmp_output)]

        if self._run_ffmpeg(cmd) and tmp_output.exists():
            input_video.unlink(missing_ok=True)
            tmp_output.rename(input_video)
        else:
            logger.error("Combined music+subtitles pass failed; original video kept.")
            tmp_output.unlink(missing_ok=True)

        # Clean up any orphaned temp files from old code paths
        for orphan in ("final_with_music.mp4", "final_subtitled.mp4"):
            p = video_dir / orphan
            if p.exists():
                try:
                    p.unlink()
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
                cmd, capture_output=True, text=True, timeout=settings.ffmpeg_timeout_seconds, check=False
            )
            if result.returncode != 0:
                logger.error("FFmpeg error: %s", result.stderr)
                return False
            return True
        except FileNotFoundError:
            logger.error("FFmpeg not found. Install FFmpeg and add to PATH.")
            return False
        except subprocess.TimeoutExpired:
            logger.error("FFmpeg timed out after %ds: %s", settings.ffmpeg_timeout_seconds, " ".join(cmd[:6]))
            return False

    def _run_ffmpeg_with_result(self, cmd: list[str]) -> subprocess.CompletedProcess[str] | None:
        try:
            return subprocess.run(
                cmd, capture_output=True, text=True, timeout=settings.ffmpeg_timeout_seconds, check=False
            )
        except FileNotFoundError:
            logger.error("FFmpeg not found. Install FFmpeg and add to PATH.")
            return None
        except subprocess.TimeoutExpired:
            logger.error("FFmpeg timed out after %ds: %s", settings.ffmpeg_timeout_seconds, " ".join(cmd[:6]))
            return None


video_service = VideoService()
