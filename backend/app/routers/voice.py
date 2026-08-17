from pathlib import Path
import logging
import os
import shutil
import subprocess
import tempfile
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Project, ProjectStatus, Scene
from app.schemas import SceneResponse, VoiceConfigUpdate, VoiceGenerateRequest
from app.services.storage import storage_service
from app.services.voice import PROVIDERS, voice_service

router = APIRouter(prefix="/voice", tags=["Voice"])

logger = logging.getLogger("voice")

SILENCE_THRESHOLD_DB = -50.0


def _find_binary(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    candidate = os.path.expandvars(
        r"%LOCALAPPDATA%\Microsoft\WinGet\Links"
    )
    candidate = os.path.join(candidate, name + ".exe")
    if os.path.exists(candidate):
        return candidate
    return name


def _probe_float(args: list[str]) -> float | None:
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            value = result.stdout.strip().splitlines()
            if value:
                return float(value[0])
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    return None


def _recording_is_silent(path: Path) -> bool:
    try:
        result = subprocess.run(
            [
                _find_binary("ffmpeg"),
                "-hide_banner",
                "-i", str(path),
                "-af", "volumedetect",
                "-f", "null",
                "-",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            return False
        for line in result.stderr.splitlines():
            if "max_volume:" in line:
                try:
                    volume = float(line.split("max_volume:")[1].strip().split()[0])
                    silent = volume <= SILENCE_THRESHOLD_DB
                    if silent:
                        logger.warning(
                            "Recording detected as silent: file=%s size=%d max_volume=%.1f dB",
                            path, path.stat().st_size if path.exists() else 0, volume,
                        )
                    return silent
                except (ValueError, IndexError):
                    return False
    except (OSError, subprocess.TimeoutExpired):
        pass
    return False


def _convert_recording_to_mp3(
    audio_bytes: bytes, slug: str, order_index: int
) -> tuple[str | None, float | None, bool]:
    tmp = Path(tempfile.gettempdir()) / f"rec_{order_index}_{int(time.time() * 1000)}.in"
    tmp.write_bytes(audio_bytes)
    try:
        if _recording_is_silent(tmp):
            return None, None, True

        relative_path = storage_service.save_binary(
            slug, "audio", f"scene_{order_index:03d}_rec.mp3", b""
        )
        mp3_path = storage_service.root.parent / relative_path
        try:
            result = subprocess.run(
                [
                    _find_binary("ffmpeg"),
                    "-y",
                    "-i", str(tmp),
                    "-vn", "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k",
                    str(mp3_path),
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode != 0 or not mp3_path.exists() or mp3_path.stat().st_size == 0:
                try:
                    mp3_path.unlink(missing_ok=True)
                except OSError:
                    pass
                return None, None, False

            duration = _probe_float(
                [
                    _find_binary("ffprobe"), "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    str(mp3_path),
                ]
            )
            return relative_path, duration, False
        except (OSError, subprocess.TimeoutExpired):
            try:
                mp3_path.unlink(missing_ok=True)
            except OSError:
                pass
            return None, None, False
    finally:
        tmp.unlink(missing_ok=True)


@router.get("/voices")
def list_voices(lang: str = ""):
    providers = voice_service.provider_list()
    for provider in providers:
        if provider["id"] == "elevenlabs":
            provider["voices"] = voice_service.fetch_elevenlabs_voices()
            provider["voice_labels"] = voice_service.voice_labels(
                "elevenlabs", provider["voices"]
            )
        elif provider["id"] == "edgetts":
            voices, labels = voice_service.fetch_edgetts_voices()
            provider["voices"] = voices
            provider["voice_labels"] = labels
    providers = voice_service.apply_language_filter(providers, lang)
    return {
        "default_provider": voice_service.DEFAULT_PROVIDER,
        "providers": providers,
    }


@router.get("/config")
def get_voice_config():
    return {
        "gemini_key_configured": bool(settings.gemini_api_key),
        "sarvam_key_configured": bool(settings.sarvam_api_key),
        "deepgram_key_configured": bool(settings.deepgram_api_key),
        "elevenlabs_key_configured": bool(settings.elevenlabs_api_key),
        "edgetts_key_configured": True,
    }


@router.post("/config")
def update_voice_config(payload: VoiceConfigUpdate):
    if payload.sarvam_api_key is not None:
        settings.update_api_key("sarvam_api_key", payload.sarvam_api_key)
    if payload.deepgram_api_key is not None:
        settings.update_api_key("deepgram_api_key", payload.deepgram_api_key)
    if payload.elevenlabs_api_key is not None:
        settings.update_api_key("elevenlabs_api_key", payload.elevenlabs_api_key)
    return get_voice_config()


@router.post("/upload", response_model=SceneResponse)
def upload_voice(
    scene_id: int = Form(...),
    voice: str = Form("Kore"),
    duration: float = Form(0.0),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    audio_bytes = file.file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("wav", "mp3", "ogg", "m4a", "aac", "flac", "webm"):
        ext = "wav"

    relative_path = None
    probed_duration = None

    if ext in ("webm", "ogg", "m4a", "aac"):
        converted_path, probed_duration, silent = _convert_recording_to_mp3(
            audio_bytes, project.slug, scene.order_index
        )
        if silent:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The recording came out completely silent. Your microphone did not "
                    "pick up any sound. Check Windows mic privacy settings and your "
                    "default input device, then record again."
                ),
            )
        if converted_path:
            relative_path = converted_path

    if relative_path is None:
        filename = f"scene_{scene.order_index:03d}.{ext}"
        relative_path = storage_service.save_binary(
            project.slug, "audio", filename, audio_bytes
        )

    scene.audio_path = relative_path
    if probed_duration and probed_duration > 0:
        scene.duration_seconds = round(probed_duration, 3)
    else:
        scene.duration_seconds = (
            duration if duration > 0 else voice_service._estimate_duration(scene.narration)
        )
    project.status = ProjectStatus.AUDIO
    db.commit()
    db.refresh(scene)
    return scene


@router.delete("/scene/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
def clear_scene_audio(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    if scene.audio_path:
        try:
            path = storage_service.root.parent / scene.audio_path
            if path.exists():
                path.unlink()
        except OSError:
            pass

    scene.audio_path = None
    scene.duration_seconds = None
    db.commit()
    return None


@router.post("/generate", response_model=SceneResponse)
def generate_voice(payload: VoiceGenerateRequest, db: Session = Depends(get_db)):
    if not payload.scene_id:
        raise HTTPException(status_code=400, detail="scene_id required")

    scene = db.query(Scene).filter(Scene.id == payload.scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        audio_path, duration = voice_service.generate_scene_audio(
            slug=project.slug,
            scene_id=scene.id,
            order_index=scene.order_index,
            narration=scene.narration,
            voice=payload.voice,
            provider=payload.provider,
            rate=payload.rate,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    scene.audio_path = audio_path
    scene.duration_seconds = duration
    project.status = ProjectStatus.AUDIO
    db.commit()
    db.refresh(scene)
    return scene


@router.post("/project/{project_id}/generate-all", response_model=list[SceneResponse])
def generate_all_voice(
    project_id: int,
    voice: str = "Kore",
    provider: str = "gemini",
    rate: str = "+0%",
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if provider not in PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider '{provider}'. Available: {', '.join(PROVIDERS)}",
        )

    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.order_index)
        .all()
    )
    if not scenes:
        raise HTTPException(status_code=400, detail="No scenes found.")

    try:
        for scene in scenes:
            audio_path, duration = voice_service.generate_scene_audio(
                slug=project.slug,
                scene_id=scene.id,
                order_index=scene.order_index,
                narration=scene.narration,
                voice=voice,
                provider=provider,
                rate=rate,
            )
            scene.audio_path = audio_path
            scene.duration_seconds = duration
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    project.status = ProjectStatus.AUDIO
    db.commit()
    for scene in scenes:
        db.refresh(scene)
    return scenes
