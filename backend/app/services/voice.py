import base64
import io
import logging
import re
import wave

import httpx

from app.config import settings
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

GEMINI_TTS_MODEL = "gemini-2.5-pro-preview-tts"

GEMINI_TTS_VOICES = [
    "Achernar",
    "Achird",
    "Algenib",
    "Algieba",
    "Alnilam",
    "Aoede",
    "Autonoe",
    "Callirrhoe",
    "Charon",
    "Despina",
    "Enceladus",
    "Erinome",
    "Fenrir",
    "Gacrux",
    "Iapetus",
    "Kore",
    "Laomedeia",
    "Leda",
    "Orus",
    "Puck",
    "Pulcherrima",
    "Rasalgethi",
    "Sadachbia",
    "Sadaltager",
    "Schedar",
    "Sulafat",
    "Umbriel",
    "Vindemiatrix",
    "Zephyr",
    "Zubenelgenubi",
]

SARVAM_VOICES = [
    "shubh",
    "aditya",
    "ritu",
    "priya",
    "neha",
    "rahul",
    "pooja",
    "rohan",
    "simran",
    "kavya",
    "amit",
    "dev",
    "ishita",
    "shreya",
    "ratan",
    "varun",
    "manan",
    "sumit",
    "roopa",
    "kabir",
    "aayan",
    "ashutosh",
    "advait",
    "anand",
    "tanya",
    "tarun",
    "sunny",
    "mani",
    "gokul",
    "vijay",
    "shruti",
    "suhani",
    "mohit",
    "kavitha",
    "rehan",
    "soham",
    "rupali",
]

DEEPGRAM_VOICES = [
    "aura-2-arcas-en",
    "aura-2-asteria-en",
    "aura-2-athena-en",
    "aura-2-aurora-en",
    "aura-2-cora-en",
    "aura-2-delia-en",
    "aura-2-draco-en",
    "aura-2-hera-en",
    "aura-2-hermes-en",
    "aura-2-hyperion-en",
    "aura-2-iris-en",
    "aura-2-juno-en",
    "aura-2-luna-en",
    "aura-2-mars-en",
    "aura-2-minerva-en",
    "aura-2-orion-en",
    "aura-2-orpheus-en",
    "aura-2-pandora-en",
    "aura-2-phoebe-en",
    "aura-2-saturn-en",
    "aura-2-selene-en",
    "aura-2-thalia-en",
    "aura-2-theia-en",
    "aura-2-vesta-en",
    "aura-2-zeus-en",
    "aura-athena-en",
    "aura-helios-en",
    "aura-hera-en",
    "aura-luna-en",
    "aura-orion-en",
    "aura-orbis-en",
    "aura-zeus-en",
]

# Curated ElevenLabs default voices (full list fetched live when an API key is set)
ELEVENLABS_VOICES = [
    ("21m00Tcm4TlvDq8ikWAM", "Rachel"),
    ("AZnzlk1XvdvUeBnXmlld", "Domi"),
    ("EXAVITQu4vr4xnSDxMaL", "Bella"),
    ("ErXwobaYiN019PkySvjV", "Antoni"),
    ("MF3mGyEYCl7XYWbV9V6O", "Elli"),
    ("TxGEqnHWrfWFTfGW9XjX", "Josh"),
    ("VR6AewLTigWG4xSOukaG", "Arnold"),
    ("pNInz6obpgDQGcFmaJgB", "Adam"),
    ("yoZ06aMxZJJ28mfd3POQ", "Sam"),
    ("XB0fDUnXU5powFXDhCwa", "Charlie"),
    ("onwK4e9ZLuTAKqWW03F9", "Daniel"),
    ("oWAxZDx7w5VEj9dCyTzz", "Paul"),
]

ELEVENLABS_MODEL = "eleven_multilingual_v2"

# Genders for the Gemini TTS voices (from Google Cloud TTS docs)
GEMINI_TTS_GENDERS = {
    "Achernar": "Female",
    "Achird": "Male",
    "Algenib": "Male",
    "Algieba": "Male",
    "Alnilam": "Male",
    "Aoede": "Female",
    "Autonoe": "Female",
    "Callirrhoe": "Female",
    "Charon": "Male",
    "Despina": "Female",
    "Enceladus": "Male",
    "Erinome": "Female",
    "Fenrir": "Male",
    "Gacrux": "Female",
    "Iapetus": "Male",
    "Kore": "Female",
    "Laomedeia": "Female",
    "Leda": "Female",
    "Orus": "Male",
    "Puck": "Male",
    "Pulcherrima": "Female",
    "Rasalgethi": "Male",
    "Sadachbia": "Male",
    "Sadaltager": "Male",
    "Schedar": "Male",
    "Sulafat": "Female",
    "Umbriel": "Male",
    "Vindemiatrix": "Female",
    "Zephyr": "Female",
    "Zubenelgenubi": "Male",
}

# Genders for Sarvam Bulbul v3 voices (from Sarvam API docs)
SARVAM_GENDERS = {
    "shubh": "Male",
    "aditya": "Male",
    "rahul": "Male",
    "rohan": "Male",
    "amit": "Male",
    "dev": "Male",
    "ratan": "Male",
    "varun": "Male",
    "manan": "Male",
    "sumit": "Male",
    "kabir": "Male",
    "aayan": "Male",
    "ashutosh": "Male",
    "advait": "Male",
    "anand": "Male",
    "tarun": "Male",
    "sunny": "Male",
    "mani": "Male",
    "gokul": "Male",
    "vijay": "Male",
    "mohit": "Male",
    "rehan": "Male",
    "soham": "Male",
    "ritu": "Female",
    "priya": "Female",
    "neha": "Female",
    "pooja": "Female",
    "simran": "Female",
    "kavya": "Female",
    "ishita": "Female",
    "shreya": "Female",
    "roopa": "Female",
    "tanya": "Female",
    "shruti": "Female",
    "suhani": "Female",
    "kavitha": "Female",
    "rupali": "Female",
}

# Genders for Deepgram Aura voices (from Deepgram TTS docs)
DEEPGRAM_GENDERS = {
    "aura-2-arcas-en": "Male",
    "aura-2-asteria-en": "Female",
    "aura-2-athena-en": "Female",
    "aura-2-aurora-en": "Female",
    "aura-2-cora-en": "Female",
    "aura-2-delia-en": "Female",
    "aura-2-draco-en": "Male",
    "aura-2-hera-en": "Female",
    "aura-2-hermes-en": "Male",
    "aura-2-hyperion-en": "Male",
    "aura-2-iris-en": "Female",
    "aura-2-juno-en": "Female",
    "aura-2-luna-en": "Female",
    "aura-2-mars-en": "Male",
    "aura-2-minerva-en": "Female",
    "aura-2-orion-en": "Male",
    "aura-2-orpheus-en": "Male",
    "aura-2-pandora-en": "Female",
    "aura-2-phoebe-en": "Female",
    "aura-2-saturn-en": "Male",
    "aura-2-selene-en": "Female",
    "aura-2-thalia-en": "Female",
    "aura-2-theia-en": "Female",
    "aura-2-vesta-en": "Female",
    "aura-2-zeus-en": "Male",
    "aura-athena-en": "Female",
    "aura-helios-en": "Male",
    "aura-hera-en": "Female",
    "aura-luna-en": "Female",
    "aura-orion-en": "Male",
    "aura-orbis-en": "Male",
    "aura-zeus-en": "Male",
}

# Genders for the curated ElevenLabs default voices
ELEVENLABS_GENDERS = {
    "21m00Tcm4TlvDq8ikWAM": "Female",  # Rachel
    "AZnzlk1XvdvUeBnXmlld": "Female",  # Domi
    "EXAVITQu4vr4xnSDxMaL": "Female",  # Bella
    "ErXwobaYiN019PkySvjV": "Male",  # Antoni
    "MF3mGyEYCl7XYWbV9V6O": "Female",  # Elli
    "TxGEqnHWrfWFTfGW9XjX": "Male",  # Josh
    "VR6AewLTigWG4xSOukaG": "Male",  # Arnold
    "pNInz6obpgDQGcFmaJgB": "Male",  # Adam
    "yoZ06aMxZJJ28mfd3POQ": "Male",  # Sam
    "XB0fDUnXU5powFXDhCwa": "Male",  # Charlie
    "onwK4e9ZLuTAKqWW03F9": "Male",  # Daniel
    "oWAxZDx7w5VEj9dCyTzz": "Male",  # Paul
}

_ELEVENLABS_NAMES = {voice_id: name for voice_id, name in ELEVENLABS_VOICES}

# Curated Microsoft Edge TTS voices (full list fetched live from edge-tts)
# Only English and Hindi voices are kept; all other languages are excluded.
EDGE_TTS_VOICES = [
    "en-US-JennyNeural",
    "en-US-GuyNeural",
    "en-US-AriaNeural",
    "en-US-ChristopherNeural",
    "en-US-EricNeural",
    "en-US-MichelleNeural",
    "en-GB-SoniaNeural",
    "en-GB-RyanNeural",
    "en-GB-LibbyNeural",
    "en-AU-NatashaNeural",
    "en-AU-WilliamNeural",
    "en-IN-NeerjaNeural",
    "en-IN-PrabhatNeural",
    "en-CA-ClaraNeural",
    "hi-IN-SwaraNeural",
    "hi-IN-MadhurNeural",
]

SUPPORTED_EDGE_LANGUAGES = ("en", "hi")

# Gender for the curated Edge TTS voices (used for user-friendly labels)
EDGE_TTS_GENDERS = {
    "en-US-JennyNeural": "Female",
    "en-US-GuyNeural": "Male",
    "en-US-AriaNeural": "Female",
    "en-US-ChristopherNeural": "Male",
    "en-US-EricNeural": "Male",
    "en-US-MichelleNeural": "Female",
    "en-GB-SoniaNeural": "Female",
    "en-GB-RyanNeural": "Male",
    "en-GB-LibbyNeural": "Female",
    "en-AU-NatashaNeural": "Female",
    "en-AU-WilliamNeural": "Male",
    "en-IN-NeerjaNeural": "Female",
    "en-IN-PrabhatNeural": "Male",
    "en-CA-ClaraNeural": "Female",
    "hi-IN-SwaraNeural": "Female",
    "hi-IN-MadhurNeural": "Male",
}


def _edge_voice_name(short_name: str) -> str:
    name = short_name.rsplit("-", 1)[-1]
    name = re.sub(r"Neural$", "", name)
    name = re.sub(r"(Multilingual|Expressive)$", "", name)
    return name


def _edge_voice_label(short_name: str, gender: str | None = None) -> str:
    gender = gender or EDGE_TTS_GENDERS.get(short_name, "Voice")
    return f"{_edge_voice_name(short_name)} ({gender})"


def _display_voice_name(provider_id: str, voice: str) -> str:
    if provider_id == "edgetts":
        return _edge_voice_name(voice)
    if provider_id == "sarvam":
        return voice.capitalize()
    if provider_id == "deepgram":
        name = voice
        for prefix in ("aura-2-", "aura-"):
            if name.startswith(prefix):
                name = name[len(prefix):]
                break
        if name.endswith("-en"):
            name = name[: -len("-en")]
        return name.capitalize()
    if provider_id == "elevenlabs":
        return _ELEVENLABS_NAMES.get(voice, voice)
    return voice


def _voice_display_label(provider_id: str, voice: str) -> str:
    gender = None
    if provider_id == "gemini":
        gender = GEMINI_TTS_GENDERS.get(voice)
    elif provider_id == "sarvam":
        gender = SARVAM_GENDERS.get(voice)
    elif provider_id == "deepgram":
        gender = DEEPGRAM_GENDERS.get(voice)
    elif provider_id == "elevenlabs":
        gender = ELEVENLABS_GENDERS.get(voice)
    name = _display_voice_name(provider_id, voice)
    if gender:
        return f"{name} ({gender})"
    return name

PROVIDERS = {
    "gemini": {
        "id": "gemini",
        "name": "Google Gemini",
        "default": "Kore",
        "voices": GEMINI_TTS_VOICES,
        "key_field": "gemini_api_key",
        "ext": "wav",
        "requires_key": True,
    },
    "sarvam": {
        "id": "sarvam",
        "name": "Sarvam AI",
        "default": "shubh",
        "voices": SARVAM_VOICES,
        "key_field": "sarvam_api_key",
        "ext": "wav",
        "requires_key": True,
    },
    "deepgram": {
        "id": "deepgram",
        "name": "Deepgram",
        "default": "aura-2-thalia-en",
        "voices": DEEPGRAM_VOICES,
        "key_field": "deepgram_api_key",
        "ext": "mp3",
        "requires_key": True,
    },
    "elevenlabs": {
        "id": "elevenlabs",
        "name": "ElevenLabs",
        "default": "21m00Tcm4TlvDq8ikWAM",
        "voices": [voice_id for voice_id, _ in ELEVENLABS_VOICES],
        "key_field": "elevenlabs_api_key",
        "ext": "mp3",
        "requires_key": True,
    },
    "edgetts": {
        "id": "edgetts",
        "name": "Microsoft Edge TTS",
        "default": "en-US-JennyNeural",
        "voices": EDGE_TTS_VOICES,
        "ext": "mp3",
        "requires_key": False,
        "allow_any_voice": True,
    },
}

_DEFAULT_PROVIDER = "gemini"


def provider_key(provider_id: str) -> str:
    info = PROVIDERS[provider_id]
    field = info.get("key_field")
    if not field:
        return ""
    return getattr(settings, field, "") or ""


def is_provider_configured(provider_id: str) -> bool:
    info = PROVIDERS[provider_id]
    if not info.get("requires_key", True):
        return True
    return bool(provider_key(provider_id))


class VoiceService:
    DEFAULT_PROVIDER = _DEFAULT_PROVIDER

    def provider_list(self) -> list[dict]:
        items = []
        for provider_id, info in PROVIDERS.items():
            item = {
                "id": provider_id,
                "name": info["name"],
                "default": info["default"],
                "voices": info["voices"],
                "requires_key": info["requires_key"],
                "key_configured": is_provider_configured(provider_id),
                "voice_labels": {
                    v: _voice_display_label(provider_id, v)
                    for v in info["voices"]
                },
            }
            items.append(item)
        return items

    def voice_labels(self, provider_id: str, voices: list[str]) -> dict[str, str]:
        return {v: _voice_display_label(provider_id, v) for v in voices}

    def apply_language_filter(
        self, providers: list[dict], lang: str = ""
    ) -> list[dict]:
        lang = (lang or "").lower()
        if lang == "hinglish":
            want = {"en", "hi"}
        elif lang in SUPPORTED_EDGE_LANGUAGES:
            want = {lang}
        else:
            want = set()
        if not want:
            return providers
        for provider in providers:
            if provider["id"] == "edgetts":
                filtered = [
                    v for v in provider["voices"] if v.split("-")[0] in want
                ]
                if filtered:
                    provider["voices"] = filtered
                    provider["voice_labels"] = {
                        v: provider["voice_labels"][v] for v in filtered
                    }
        return providers

    def _resolve_provider(self, provider: str) -> dict:
        provider = (provider or self.DEFAULT_PROVIDER).lower()
        if provider not in PROVIDERS:
            raise ValueError(
                f"Unknown provider '{provider}'. Available: {', '.join(PROVIDERS)}"
            )
        return PROVIDERS[provider]

    def _resolve_voice(self, info: dict, voice: str | None) -> str:
        if info.get("allow_any_voice"):
            return voice or info["default"]
        return voice if voice and voice in info["voices"] else info["default"]

    def generate_scene_audio(
        self,
        slug: str,
        scene_id: int,
        order_index: int,
        narration: str,
        voice: str | None = None,
        provider: str | None = None,
        rate: str = "+0%",
    ) -> tuple[str, float]:
        info = self._resolve_provider(provider)
        provider_id = info["id"]
        voice = self._resolve_voice(info, voice)
        ext = info["ext"]
        filename = f"scene_{order_index:03d}.{ext}"

        key = provider_key(provider_id)
        if info.get("requires_key", True) and not key:
            raise ValueError(
                f"No API key configured for {info['name']}. "
                "Add it in the Voice tab (or set it in .env)."
            )

        try:
            audio_bytes = self._synthesize(provider_id, narration, voice, key, rate)
        except Exception as exc:
            logger.warning("TTS generation failed (%s): %s", provider_id, exc)
            raise ValueError(f"{info['name']} TTS failed: {exc}") from exc

        if not audio_bytes:
            raise ValueError(f"{info['name']} returned empty audio.")

        relative_path = storage_service.save_binary(slug, "audio", filename, audio_bytes)
        duration = self._estimate_duration(narration)
        return relative_path, duration

    def _synthesize(self, provider: str, text: str, voice: str, key: str, rate: str = "+0%") -> bytes:
        if provider == "gemini":
            return self._synthesize_gemini(text, voice, key)
        if provider == "sarvam":
            return self._synthesize_sarvam(text, voice, key)
        if provider == "deepgram":
            return self._synthesize_deepgram(text, voice, key)
        if provider == "elevenlabs":
            return self._synthesize_elevenlabs(text, voice, key)
        if provider == "edgetts":
            return self._synthesize_edgetts(text, voice, key, rate)
        raise ValueError(f"Unknown provider '{provider}'")

    def _synthesize_gemini(self, text: str, voice: str, key: str) -> bytes:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)
        response = client.models.generate_content(
            model=GEMINI_TTS_MODEL,
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice,
                        )
                    )
                ),
            ),
        )
        return self._pcm_to_wav(response)

    def _synthesize_sarvam(self, text: str, voice: str, key: str) -> bytes:
        payload = {
            "text": text,
            "target_language_code": "en-IN",
            "speaker": voice,
            "model": "bulbul:v3",
            "pace": 1.0,
            "output_audio_codec": "wav",
        }
        response = httpx.post(
            "https://api.sarvam.ai/text-to-speech",
            json=payload,
            headers={"api-subscription-key": key, "Content-Type": "application/json"},
            timeout=90,
        )
        response.raise_for_status()
        data = response.json()
        audios = data.get("audios") or []
        if not audios:
            raise ValueError("Sarvam returned no audio")
        return base64.b64decode(audios[0])

    def _synthesize_deepgram(self, text: str, voice: str, key: str) -> bytes:
        url = f"https://api.deepgram.com/v1/speak?model={voice}&encoding=mp3"
        response = httpx.post(
            url,
            json={"text": text},
            headers={"Authorization": f"Token {key}", "Content-Type": "application/json"},
            timeout=90,
        )
        response.raise_for_status()
        return response.content

    def _synthesize_elevenlabs(self, text: str, voice: str, key: str) -> bytes:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
        response = httpx.post(
            url,
            json={"text": text, "model_id": ELEVENLABS_MODEL},
            headers={
                "xi-api-key": key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            timeout=90,
        )
        response.raise_for_status()
        return response.content

    def _synthesize_edgetts(self, text: str, voice: str, key: str, rate: str = "+0%") -> bytes:
        import asyncio
        import tempfile
        import time
        from pathlib import Path
        from uuid import uuid4

        try:
            import edge_tts
        except ImportError as exc:
            raise ValueError(
                "edge-tts is not installed. Run: pip install edge-tts"
            ) from exc

        last_exc: Exception | None = None
        for attempt in range(3):
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            tmp = Path(tempfile.gettempdir()) / f"edgetts_{uuid4().hex}.mp3"
            try:
                asyncio.run(communicate.save(str(tmp)))
                data = tmp.read_bytes()
                if not data:
                    raise ValueError("Edge TTS returned empty audio")
                return data
            except Exception as exc:  # endpoint is flaky; retry with a fresh token
                last_exc = exc
                logger.warning(
                    "Edge TTS attempt %d/3 failed (%s): %s", attempt + 1, voice, exc
                )
            finally:
                tmp.unlink(missing_ok=True)
            time.sleep(2)
        raise ValueError(f"Edge TTS failed after 3 attempts: {last_exc}")

    def fetch_edgetts_voices(self) -> tuple[list[str], dict[str, str]]:
        try:
            import asyncio

            import edge_tts

            voices = asyncio.run(edge_tts.list_voices())
            supported = [
                v
                for v in voices
                if v.get("ShortName")
                and v["ShortName"].split("-")[0] in SUPPORTED_EDGE_LANGUAGES
            ]
            names = sorted(v["ShortName"] for v in supported)
            if names:
                labels = {
                    v["ShortName"]: _edge_voice_label(
                        v["ShortName"], v.get("Gender")
                    )
                    for v in supported
                }
                return names, labels
        except Exception as exc:
            logger.warning("Could not fetch Edge TTS voices: %s", exc)
        return (
            EDGE_TTS_VOICES,
            {
                v: _edge_voice_label(v)
                for v in EDGE_TTS_VOICES
            },
        )

    def fetch_elevenlabs_voices(self) -> list[str]:
        key = provider_key("elevenlabs")
        if not key:
            return [voice_id for voice_id, _ in ELEVENLABS_VOICES]
        try:
            response = httpx.get(
                "https://api.elevenlabs.io/v1/voices",
                headers={"xi-api-key": key},
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
            voices = [
                v["voice_id"] for v in data.get("voices", []) if v.get("voice_id")
            ]
            if voices:
                return voices
        except Exception as exc:
            logger.warning("Could not fetch ElevenLabs voices: %s", exc)
        return [voice_id for voice_id, _ in ELEVENLABS_VOICES]

    @staticmethod
    def _pcm_to_wav(response) -> bytes:
        audio_part = response.candidates[0].content.parts[0].inline_data
        pcm_data = audio_part.data
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(pcm_data)
        return buffer.getvalue()

    @staticmethod
    def _estimate_duration(text: str, wpm: int = 150) -> float:
        word_count = len(text.split())
        return max(3.0, (word_count / wpm) * 60)


voice_service = VoiceService()
