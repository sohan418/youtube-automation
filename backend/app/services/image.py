import io
import logging

from PIL import Image, ImageDraw

from app.config import settings
from app.services.ai import ai_service
from app.services.storage import storage_service

logger = logging.getLogger(__name__)


class ImageService:
    def generate_scene_image(
        self,
        slug: str,
        scene_id: int,
        order_index: int,
        narration: str,
        image_prompt: str | None = None,
        style: str | None = None,
    ) -> str:
        prompt = image_prompt or ai_service.generate_image_prompt(narration, style)
        filename = f"scene_{order_index:03d}.png"

        if settings.openai_api_key:
            try:
                from openai import OpenAI

                client = OpenAI(api_key=settings.openai_api_key)
                response = client.images.generate(
                    model="dall-e-3",
                    prompt=prompt,
                    size="1792x1024",
                    quality="standard",
                    n=1,
                )
                import httpx

                image_url = response.data[0].url
                if image_url:
                    img_response = httpx.get(image_url, timeout=60)
                    img_response.raise_for_status()
                    return storage_service.save_binary(
                        slug, "images", filename, img_response.content
                    )
            except Exception as exc:
                logger.warning("DALL-E generation failed, using placeholder: %s", exc)

        return self._create_placeholder(slug, filename, prompt, order_index)

    def generate_thumbnail(
        self,
        slug: str,
        index: int,
        prompt: str,
    ) -> str:
        filename = f"thumbnail_{index:03d}.png"

        if settings.openai_api_key:
            try:
                from openai import OpenAI

                client = OpenAI(api_key=settings.openai_api_key)
                response = client.images.generate(
                    model="dall-e-3",
                    prompt=f"YouTube thumbnail: {prompt}. Bold text, high contrast, 16:9 aspect ratio.",
                    size="1792x1024",
                    quality="standard",
                    n=1,
                )
                import httpx

                image_url = response.data[0].url
                if image_url:
                    img_response = httpx.get(image_url, timeout=60)
                    img_response.raise_for_status()
                    return storage_service.save_binary(
                        slug, "thumbnail", filename, img_response.content
                    )
            except Exception as exc:
                logger.warning("Thumbnail generation failed, using placeholder: %s", exc)

        return self._create_placeholder(slug, filename, prompt, index, subdir="thumbnail")

    def _create_placeholder(
        self,
        slug: str,
        filename: str,
        prompt: str,
        index: int,
        subdir: str = "images",
    ) -> str:
        width, height = 1920, 1080
        img = Image.new("RGB", (width, height), color=(30, 30, 60))
        draw = ImageDraw.Draw(img)

        draw.rectangle([0, 0, width, 80], fill=(60, 60, 120))
        draw.text((20, 25), f"Scene {index} — Placeholder", fill=(255, 255, 255))

        wrapped = self._wrap_text(prompt, 80)
        y = 120
        for line in wrapped[:8]:
            draw.text((40, y), line, fill=(200, 200, 220))
            y += 30

        draw.text(
            (40, height - 60),
            "Set OPENAI_API_KEY for AI-generated images",
            fill=(150, 150, 170),
        )

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return storage_service.save_binary(slug, subdir, filename, buffer.getvalue())

    @staticmethod
    def _wrap_text(text: str, width: int) -> list[str]:
        words = text.split()
        lines: list[str] = []
        current: list[str] = []
        for word in words:
            test = " ".join(current + [word])
            if len(test) <= width:
                current.append(word)
            else:
                if current:
                    lines.append(" ".join(current))
                current = [word]
        if current:
            lines.append(" ".join(current))
        return lines


image_service = ImageService()
