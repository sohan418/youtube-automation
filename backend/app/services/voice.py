import logging

from app.config import settings
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


class VoiceService:
    VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]

    def generate_scene_audio(
        self,
        slug: str,
        scene_id: int,
        order_index: int,
        narration: str,
        voice: str = "alloy",
    ) -> tuple[str, float]:
        filename = f"scene_{order_index:03d}.mp3"
        voice = voice if voice in self.VOICES else "alloy"

        if settings.openai_api_key:
            try:
                from openai import OpenAI

                client = OpenAI(api_key=settings.openai_api_key)
                response = client.audio.speech.create(
                    model="tts-1",
                    voice=voice,
                    input=narration,
                )
                audio_bytes = response.content
                relative_path = storage_service.save_binary(
                    slug, "audio", filename, audio_bytes
                )
                duration = self._estimate_duration(narration)
                return relative_path, duration
            except Exception as exc:
                logger.warning("TTS generation failed: %s", exc)

        return self._create_silent_placeholder(slug, filename, narration), self._estimate_duration(
            narration
        )

    def _create_silent_placeholder(self, slug: str, filename: str, narration: str) -> str:
        text_filename = filename.replace(".mp3", ".txt")
        storage_service.save_text(slug, "audio", text_filename, narration)
        placeholder = b"ID3\x04\x00\x00\x00\x00\x00\x00"
        return storage_service.save_binary(slug, "audio", filename, placeholder)

    @staticmethod
    def _estimate_duration(text: str, wpm: int = 150) -> float:
        word_count = len(text.split())
        return max(3.0, (word_count / wpm) * 60)


voice_service = VoiceService()
