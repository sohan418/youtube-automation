import json
import logging
import re
from typing import Any

from app.services.providers import TextProvider, build_provider

logger = logging.getLogger(__name__)

_MOCK_IDEA_TEMPLATES: list[tuple[str, str, int]] = [
    ("Top 10 {category} Secrets Nobody Tells You", "The hidden strategies experts use to dominate {category} content.", 94),
    ("How to Get Started in {category}: A Beginner's Guide", "A step-by-step roadmap to building your {category} channel from zero.", 91),
    ("5 {category} Mistakes That Are Killing Your Growth", "Avoid these common pitfalls to grow faster in the {category} niche.", 88),
    ("The Future of {category} in 2026", "Trends and predictions shaping the {category} space this year.", 86),
    ("{category} Q&A: Answering Your Burning Questions", "Real questions from the community about {category}, answered.", 84),
]

_LANGUAGE_SCRIPT_TEMPLATES: dict[str, dict[str, str]] = {
    "en": {
        "title": "{topic}: The Complete 2026 Guide",
        "hook": "What if everything you know about {topic} was about to change?",
        "body": (
            "Today we're diving deep into {topic}.\n\n"
            "First, let's cover the basics. Whether you're a beginner or already experienced, understanding the fundamentals is essential to getting real results.\n\n"
            "Next, the core strategies. The most successful people follow a simple framework: start small, stay consistent, and measure what works.\n\n"
            "Then, common mistakes. Most people fail not because of lack of effort, but because of avoidable errors. We'll show you what to watch out for.\n\n"
            "Finally, tools and resources. You don't need expensive gear to succeed — with the right approach, free tools are more than enough to get started.\n\n"
            "That wraps up this {minutes}-minute deep dive. Remember: progress over perfection."
        ),
        "ending": (
            "If you enjoyed this guide, hit subscribe for more content like this. "
            "Drop your questions in the comments — see you in the next one!"
        ),
    },
    "hi": {
        "title": "{topic} — 2026 ki Sampurna Guide",
        "hook": "Kya aap jante hain ki {topic} ke baare mein sab kuch badalne wala hai?",
        "body": (
            "Aaj hum {topic} ke baare mein gehrai se jaanenge.\n\n"
            "Pehle basics. Chahe aap beginner hon ya experienced, fundamentals samajhna sabse zaroori hai.\n\n"
            "Ab core strategies. Successful log ek simple framework follow karte hain: chhote steps se shuru karo, consistent raho, aur jo kaam kare use measure karo.\n\n"
            "Phir common mistakes. Zyada tar log mehnat ki kami ki nahi, balki avoidable galtiyon ki wajah se fail hote hain.\n\n"
            "Aakhir mein, tools aur resources. Kamyab hone ke liye mehenge instruments ki zaroorat nahi — sahi approach ke saath free tools hi kaafi hain.\n\n"
            "Isi ke saath {minutes} minute ki yah deep dive samapt hoti hai. Yaad rakhein: progress over perfection."
        ),
        "ending": (
            "Agar yah guide pasand aayi ho, toh channel subscribe karein aur comments mein apne sawal poochhein. "
            "Agle video mein milte hain!"
        ),
    },
    "hinglish": {
        "title": "{topic}: The Complete 2026 Guide",
        "hook": "Kya aap jante hain ki {topic} ke baare mein sab kuch badalne wala hai?",
        "body": (
            "Aaj hum {topic} ke baare mein deep dive karenge.\n\n"
            "First, basics se shuru karte hain. Chahe aap beginner ho ya experienced, fundamentals clear hona sabse zaroori hai.\n\n"
            "Next, core strategies. Successful log ek simple framework follow karte hain: chhote steps se shuru karo, consistent raho, aur jo kaam kare use measure karo.\n\n"
            "Then, common mistakes. Zyada tar log avoidable galtiyon ki wajah se fail hote hain — hum dikhayenge kya galtiyan avoid karni chahiye.\n\n"
            "Finally, tools aur resources. Kamyab hone ke liye mehenge gear ki zaroorat nahi — sahi approach ke saath free tools hi kaafi hain.\n\n"
            "Bas itna hi! {minutes} minute ki yah deep dive yahan khatam hoti hai. Remember: progress over perfection."
        ),
        "ending": (
            "Agar yah guide pasand aayi ho, toh subscribe karna mat bhoolna aur comments mein apne sawal poochho. "
            "See you in the next one!"
        ),
    },
}


_SEO_LANGUAGE_TEMPLATES: dict[str, dict[str, str | list[str]]] = {
    "en": {
        "title": "{title} | Full Guide & Tutorial (2026)",
        "description": (
            "In this video, we break down {title} step by step.\n\n"
            "What you'll learn:\n"
            "• The fundamentals of {title}\n"
            "• Step-by-step strategies that actually work\n"
            "• Common mistakes to avoid\n\n"
            "Related keywords: {keywords}\n\n"
            "If you found this helpful, hit subscribe for more videos like this and drop your questions in the comments."
        ),
        "base_tags": ["tutorial", "guide", "tips", "how to", "2026"],
        "hashtags": ["#Tutorial", "#Guide", "#HowTo", "#2026"],
    },
    "hi": {
        "title": "{title} | Poori Guide aur Tutorial (2026)",
        "description": (
            "Is video mein hum {title} ke baare mein step-by-step samjhenge.\n\n"
            "Is video mein aap seekhenge:\n"
            "• {title} ke fundamentals\n"
            "• Kaam karne wali strategies\n"
            "• Aam galtiyan jo avoid karni chahiye\n\n"
            "Related keywords: {keywords}\n\n"
            "Agar video pasand aaye toh subscribe karein aur comments mein apna sawal poochhein."
        ),
        "base_tags": ["tutorial", "guide", "tips", "2026", "hindi"],
        "hashtags": ["#Tutorial", "#Guide", "#2026", "#Hindi"],
    },
    "hinglish": {
        "title": "{title} | Full Guide & Tutorial (2026)",
        "description": (
            "Is video mein hum {title} ke baare mein step-by-step break down karenge.\n\n"
            "Is video mein aap seekhoge:\n"
            "• {title} ke fundamentals\n"
            "• Working strategies jo kaam karein\n"
            "• Common mistakes jo avoid karni chahiye\n\n"
            "Related keywords: {keywords}\n\n"
            "Agar video pasand aaye toh subscribe karna mat bhoolna aur comments mein apne sawal poochho."
        ),
        "base_tags": ["tutorial", "guide", "tips", "how to", "2026"],
        "hashtags": ["#Tutorial", "#Guide", "#HowTo", "#2026"],
    },
}


_LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "hinglish": "Hinglish",
}


class AIService:
    def __init__(self) -> None:
        self.provider: TextProvider | None = None
        try:
            self.provider = build_provider()
        except ValueError as exc:
            logger.warning("AI provider misconfigured: %s", exc)
        if self.provider is None:
            logger.warning("No AI provider configured — using mock AI responses")

    @property
    def provider_name(self) -> str:
        return self.provider.name if self.provider else "mock"

    def complete(self, system: str, prompt: str, json_mode: bool = False) -> str:
        return self._chat(system, prompt, json_mode=json_mode)

    def _chat(self, system: str, user: str, json_mode: bool = False) -> str:
        if self.provider is None:
            return self._mock_response(system, user)
        return self.provider.complete(system, user, json_mode=json_mode)

    def _generate_json(
        self,
        system: str,
        user: str,
        attempts: int = 3,
        label: str = "AI generation",
    ) -> dict:
        last_error: Exception | None = None
        for attempt in range(attempts):
            try:
                raw = self._chat(system, user, json_mode=True)
                if not raw or not raw.strip():
                    raise ValueError("AI returned an empty response")
                return TextProvider.extract_json(raw)
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "%s attempt %d/%d failed (%s): %s",
                    label,
                    attempt + 1,
                    attempts,
                    type(exc).__name__,
                    exc,
                )
        raise ValueError(f"{label} failed: {last_error}") from last_error

    def _mock_response(self, system: str, user: str) -> str:
        logger.warning("No AI provider configured — using mock AI responses")
        system_lower = system.lower()
        if "trend analyst" in system_lower or "video idea" in system_lower:
            return self._mock_ideas(user)
        if "scriptwriter" in system_lower:
            return self._mock_script(user)
        if "video director" in system_lower:
            return self._mock_scenes(user)
        if "seo expert" in system_lower:
            return self._mock_seo(user)
        if "thumbnail designer" in system_lower:
            return "Bold YouTube thumbnail with text 'AI VIDEO GUIDE', shocked face emoji style, bright yellow and red colors, high contrast"
        if "image prompt engineer" in system_lower:
            return self._mock_image_prompt(user)
        return "Mock AI response — set OPENAI_API_KEY for real generation."

    def build_ideas_prompt(
        self, category: str | None, count: int, language: str, topic: str | None = None,
        recent_videos: list[dict[str, Any]] | None = None,
    ) -> dict[str, str]:
        """Build the exact prompt that generate_ideas would send to the LLM."""
        category_text = f" in the '{category}' category" if category else ""
        topic_text = f" about: {topic}" if topic else ""
        system = "You are a YouTube trend analyst. Generate video ideas as JSON."
        user = (
            f"Generate {count} trending YouTube video ideas{topic_text}{category_text}. "
            f"Language: {language}. "
            "IMPORTANT: Each idea must be thematically connected to the one before it — "
            "think of them as episodes in a series where each video naturally leads into the next. "
            "If the first idea is about a topic, the second should follow from it, "
            "the third from the second, and so on, creating a cohesive content chain. "
        )
        if recent_videos:
            user += "Here are my recent videos (for context - generate NEW and DIFFERENT ideas, don't repeat these):\n"
            for i, v in enumerate(recent_videos[:10], 1):
                user += f"{i}. {v['title']} - {v.get('description', '')[:80]}\n"
            user += "\nGenerate ideas that complement but are distinct from these existing videos. "
        user += (
            'Return JSON: {"ideas": [{"title": "...", "description": "...", '
            '"category": "...", "trending_score": 0-100}]}'
        )
        return {"system": system, "user": user}

    def generate_ideas(
        self, category: str | None, count: int, language: str, topic: str | None = None,
        recent_videos: list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        prompts = self.build_ideas_prompt(category, count, language, topic, recent_videos)
        data = self._generate_json(prompts["system"], prompts["user"], label="Idea generation")
        return data.get("ideas", [])

    def _mock_ideas(self, user: str) -> str:
        category_match = re.search(r"in the ['\"](.+?)['\"] category", user)
        category = category_match.group(1).strip() if category_match else "Technology"
        topic_match = re.search(
            r"about:\s*(.+?)(?:\s+in the\s*['\"]|\.\s|\.$|$)", user
        )
        topic = topic_match.group(1).strip() if topic_match else None
        count_match = re.search(r"Generate (\d+) trending", user)
        count = int(count_match.group(1)) if count_match else 5
        subject = topic if topic else category

        ideas: list[dict[str, Any]] = []
        for title, description, score in _MOCK_IDEA_TEMPLATES[:count]:
            ideas.append(
                {
                    "title": title.format(category=subject),
                    "description": description.format(category=subject),
                    "category": category,
                    "trending_score": score,
                }
            )
        return json.dumps({"ideas": ideas})

    def _mock_script(self, user: str) -> str:
        topic_match = re.search(r"about:\s*(.+?)(?:\.\s|\.$)", user)
        topic = topic_match.group(1).strip() if topic_match else "Your Favorite Topic"
        duration_match = re.search(r"(\d+)-minute", user)
        minutes = int(duration_match.group(1)) if duration_match else 5
        language_match = re.search(r"Language:\s*(\w+)", user)
        language = (language_match.group(1) if language_match else "en").lower()
        language = language if language in _LANGUAGE_SCRIPT_TEMPLATES else "en"

        template = _LANGUAGE_SCRIPT_TEMPLATES[language]
        return json.dumps(
            {
                "title": template["title"].format(topic=topic),
                "hook": template["hook"].format(topic=topic),
                "body": template["body"].format(topic=topic, minutes=minutes),
                "ending": template["ending"].format(topic=topic),
            }
        )

    def _mock_scenes(self, user: str) -> str:
        hook = re.search(r"Hook:\s*(.*?)\n\nBody:", user, re.DOTALL)
        body = re.search(r"Body:\s*(.*?)\n\nEnding:", user, re.DOTALL)
        ending = re.search(r"Ending:\s*(.*?)(?:\n\s*Return\b|$)", user, re.DOTALL)
        hook = hook.group(1).strip() if hook else "Let's dive right in."
        body = body.group(1).strip() if body else "Today we're exploring this topic step by step."
        ending = ending.group(1).strip() if ending else "Subscribe for more content like this!"

        count_match = re.search(r"EXACTLY (\d+) scenes", user)
        count = int(count_match.group(1)) if count_match else None

        segments: list[str] = [hook]
        segments += [p.strip() for p in body.split("\n\n") if p.strip()]
        segments.append(ending)
        if count:
            segments = self._fit_segments(segments, count)

        scenes = [
            {
                "narration": self._clean_narration(segment),
                "image_prompt": self._clean_narration(
                    f"Cinematic visual illustrating: {self._clip(segment, 120)}"
                ),
            }
            for segment in segments
        ]
        return json.dumps({"scenes": scenes})

    @staticmethod
    def _clip(text: str, limit: int = 120) -> str:
        text = text.strip()
        if len(text) <= limit:
            return text
        cut = text[:limit]
        if " " in cut:
            cut = cut[: cut.rfind(" ")]
        return cut.rstrip(" .,;:!?") + " ..."

    @staticmethod
    def _fit_segments(segments: list[str], count: int) -> list[str]:
        if len(segments) == count:
            return segments
        if len(segments) > count:
            out = segments[:]
            while len(out) > count:
                merged = (out[-2] + " " + out[-1]).strip()
                out = out[:-2] + [merged]
            return out
        sentences: list[str] = []
        for seg in segments:
            sentences += [s.strip() for s in re.split(r"(?<=[.!?])\s+", seg) if s.strip()]
        if len(sentences) >= count:
            return sentences[:count]
        return sentences + [sentences[-1]] * (count - len(sentences))

    def generate_script(
        self,
        topic: str,
        language: str,
        target_duration_minutes: int,
    ) -> dict[str, str]:
        prompts = self.build_script_prompt(topic, language, target_duration_minutes)
        try:
            raw = self._chat(prompts["system"], prompts["user"], json_mode=True)
            data = TextProvider.extract_json(raw)
            if not data or "body" not in data:
                return json.loads(self._mock_script(prompts["user"]))
            return data
        except Exception:
            logger.warning("Script generation failed, falling back to mock script")
            return json.loads(self._mock_script(prompts["user"]))

    def build_script_prompt(
        self, topic: str, language: str, target_duration_minutes: int,
    ) -> dict[str, str]:
        system = "You are an expert YouTube scriptwriter. Write engaging scripts as JSON."
        user = (
            f"Write a {target_duration_minutes}-minute YouTube script about: {topic}. "
            f"Language: {language}. Include hook, body, and ending. "
            'Return JSON: {"title": "...", "hook": "...", "body": "...", "ending": "..."}'
        )
        return {"system": system, "user": user}

    def build_scenes_prompt(
        self, script_body: str, hook: str, ending: str, language: str = "en",
        count: int | None = None, ratio: str = "16:9",
    ) -> dict[str, str]:
        system = (
            "You are a video director. Break scripts into scenes as JSON. "
            "Each scene has a 'narration', an 'image_prompt', and a 'video_prompt'. "
            "Narrations are spoken voice-over text ONLY — never include instructions, "
            "JSON, or any metadata in them. Keep each narration short (one or two "
            "sentences). If a section of the script is long, split it into multiple scenes. "
            "Write every narration in the requested language; image prompts stay in English. "
            "Both the image_prompt and video_prompt MUST always mention the aspect ratio "
            f"'{ratio}' so every scene stays consistent."
        )
        lang_name = _LANGUAGE_NAMES.get(language, language or "English")
        count_text = (
            f"Split the script into EXACTLY {count} scenes."
            if count
            else "Split the script into a natural number of scenes based on the content."
        )
        user = (
            f"Break this script into scenes. Each scene needs narration, an image prompt, "
            f"and a video prompt.\n\n"
            f"Language: {language} ({lang_name})\n\n"
            f"Aspect ratio: {ratio}\n\n"
            f"Write all narrations in {lang_name}.\n\n"
            f"{count_text}\n\n"
            f"Hook: {hook}\n\nBody: {script_body}\n\nEnding: {ending}\n\n"
            'Return ONLY valid JSON: {"scenes": [{"narration": "...", "image_prompt": "...", "video_prompt": "..."}]}'
        )
        return {"system": system, "user": user}

    def generate_scenes(
        self,
        script_body: str,
        hook: str,
        ending: str,
        language: str = "en",
        count: int | None = None,
        ratio: str = "16:9",
    ) -> list[dict[str, str]]:
        prompts = self.build_scenes_prompt(script_body, hook, ending, language, count, ratio)
        data = self._generate_json(prompts["system"], prompts["user"], label="Scene generation")
        scenes: list[dict[str, str]] = []
        for raw_scene in data.get("scenes", []):
            narration = self._clean_narration(raw_scene.get("narration") or "")
            if not narration:
                continue
            image_prompt = self._clean_narration(raw_scene.get("image_prompt") or "")
            video_prompt = self._clean_narration(raw_scene.get("video_prompt") or "")
            if image_prompt and ratio not in image_prompt:
                image_prompt = f"{image_prompt}, {ratio} aspect ratio"
            if video_prompt and ratio not in video_prompt:
                video_prompt = f"{video_prompt}, {ratio} aspect ratio"
            scenes.append(
                {
                    "narration": narration,
                    "image_prompt": image_prompt,
                    "video_prompt": video_prompt,
                }
            )
        return scenes

    @staticmethod
    def _clean_narration(text: str) -> str:
        if not text:
            return ""
        cleaned = re.sub(r"\bReturn\s+(?:ONLY|a)\s+(?:valid\s+)?JSON\b.*$", "", text, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r"\bReturn JSON\b.*$", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r'\{\s*"scenes"\s*:.*$', "", cleaned, flags=re.DOTALL)
        cleaned = re.sub(
            r"\b(?:if text is long\s*,\s*)?wrap it\b.*$",
            "",
            cleaned,
            flags=re.DOTALL | re.IGNORECASE,
        )
        return re.sub(r"\s+", " ", cleaned).strip()

    def build_image_prompt(
        self, scene_narration: str, style: str | None = None, ratio: str = "16:9",
    ) -> dict[str, str]:
        style_text = f" Style: {style}." if style else ""
        system = (
            "You are an expert image prompt engineer for AI art generation. "
            "Create ONE detailed image prompt in English that visually shows what the "
            "scene's narration is describing. Describe concrete visual imagery: setting, "
            "subject, objects, mood, and lighting. Output only the prompt itself. "
            "No text, no words, no watermarks, no labels. Cinematic, ultra detailed, "
            f"{ratio} aspect ratio."
        )
        user = (
            f"Scene narration: {scene_narration}.\n"
            f"Create a detailed cinematic image prompt that visualizes this scene. "
            f"Always include the {ratio} aspect ratio.{style_text}"
        )
        return {"system": system, "user": user}

    def generate_image_prompt(
        self,
        scene_narration: str,
        style: str | None = None,
        ratio: str = "16:9",
    ) -> str:
        prompts = self.build_image_prompt(scene_narration, style, ratio)
        return self._chat(prompts["system"], prompts["user"])

    @staticmethod
    def _mock_image_prompt(user: str) -> str:
        match = re.search(r"Scene narration:\s*(.*?)(?:\n|$)", user, re.DOTALL)
        narration = match.group(1).strip() if match else ""
        narration = re.sub(r"\s+", " ", narration)
        narration = narration.rstrip("?.!")
        narration = narration[:240]
        if not narration:
            narration = "the scene"
        ratio_match = re.search(r"(16:9|9:16)", user)
        ratio = ratio_match.group(1) if ratio_match else "16:9"
        style_match = re.search(r"Style:\s*([^\n.]+)", user)
        style = f" Style: {style_match.group(1).strip()}." if style_match else ""
        return (
            f"Cinematic visual illustrating: {narration}. "
            "Epic scale, dramatic volumetric lighting, cinematic color grading, "
            "ultra detailed, 8K, "
            f"{ratio} aspect ratio, no text or watermarks."
            f"{style}"
        )

    def _mock_seo(self, user: str) -> str:
        title_match = re.search(r"Title:\s*(.+)", user)
        title = title_match.group(1).strip() if title_match else "Your YouTube Video"
        language_match = re.search(r"Language:\s*(\w+)", user)
        language = (language_match.group(1) if language_match else "en").lower()
        language = language if language in _SEO_LANGUAGE_TEMPLATES else "en"

        keywords = self._title_keywords(title)
        template = _SEO_LANGUAGE_TEMPLATES[language]
        tags = ", ".join(dict.fromkeys(keywords + template["base_tags"]))
        hashtags = " ".join(dict.fromkeys(template["hashtags"] + [f"#{k}" for k in keywords]))

        return json.dumps(
            {
                "title": template["title"].format(title=title),
                "description": template["description"].format(
                    title=title, keywords=", ".join(keywords)
                ),
                "tags": tags,
                "hashtags": hashtags,
            }
        )

    @staticmethod
    def _title_keywords(title: str) -> list[str]:
        stop_words = {
            "the", "a", "an", "of", "to", "for", "and", "with", "how",
            "in", "on", "top", "is", "that", "this", "are", "you", "your",
        }
        return [
            w.lower()
            for w in re.findall(r"\b[a-zA-Z0-9]+\b", title)
            if w.lower() not in stop_words and len(w) > 2
        ]

    def build_seo_prompt(
        self, script_title: str, script_body: str, language: str,
    ) -> dict[str, str]:
        system = "You are a YouTube SEO expert. Generate metadata as JSON."
        user = (
            f"Generate SEO metadata for a YouTube video.\nTitle: {script_title}\n"
            f"Script excerpt: {script_body[:500]}\nLanguage: {language}\n"
            'Return JSON: {"title": "...", "description": "...", "tags": "...", "hashtags": "..."}\n'
            "CRITICAL: The tags field is a single comma-separated string. "
            "The entire tags string MUST be 500 characters or fewer (YouTube's hard limit). "
            "Prioritise the most relevant tags first; drop low-value ones if you approach the limit. "
            "Do NOT pad with generic filler tags."
        )
        return {"system": system, "user": user}

    def generate_seo(
        self, script_title: str, script_body: str, language: str
    ) -> dict[str, str]:
        prompts = self.build_seo_prompt(script_title, script_body, language)
        return self._generate_json(prompts["system"], prompts["user"], label="SEO generation")

    def generate_thumbnail_prompt(self, title: str, style: str | None = None) -> str:
        style_text = f" Style: {style}." if style else ""
        system = (
            "You are an expert YouTube thumbnail designer and AI prompt engineer. "
            "Create ONE detailed, eye-catching image prompt in English for generating a YouTube thumbnail. "
            "Describe the subject, high-emotion facial expressions, vibrant color palette, dynamic lighting, and text overlays. "
            "CRITICAL INSTRUCTION: Output ONLY the plain text prompt itself. Do NOT include markdown headers, bold asterisks (**), "
            "hashtags (#), code block ticks (```), emojis, or introductory labels like 'Thumbnail Prompt:'."
        )
        user = f"Create a thumbnail image prompt for a video titled: '{title}'.{style_text}"
        raw = self._chat(system, user)
        return self._clean_prompt(raw)

    @staticmethod
    def _clean_prompt(text: str) -> str:
        if not text:
            return ""
        cleaned = re.sub(r"```[a-z]*", "", text, flags=re.IGNORECASE).replace("```", "")
        cleaned = re.sub(r"^\s*[#*•📌:-]+\s*", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", cleaned)
        cleaned = re.sub(r"#{1,6}\s*", "", cleaned)
        cleaned = re.sub(
            r"^(?:YouTube\s+)?Thumbnail\s+Prompt(?:\s*\([^)]*\))?\s*[-–:]*\s*",
            "",
            cleaned,
            flags=re.IGNORECASE | re.MULTILINE,
        )
        cleaned = re.sub(r"^Prompt\s*[-–:]*\s*", "", cleaned, flags=re.IGNORECASE | re.MULTILINE)
        return cleaned.strip()

    def recommend_music(
        self, script_title: str, script_body: str, category: str | None = None, language: str = "en"
    ) -> dict[str, Any]:
        system = (
            "You are a professional video sound designer and YouTube soundtrack curator. "
            "Analyze the script and recommend ideal background music search keywords, mood, genre tags, and volume."
        )
        user = (
            f"Video Title: {script_title}\n"
            f"Category: {category or 'General'}\n"
            f"Language: {language}\n"
            f"Script Excerpt: {script_body[:600]}\n\n"
            "Recommend background music. Return ONLY valid JSON:\n"
            "{\n"
            '  "mood": "e.g. Chill Lo-Fi / Relaxed",\n'
            '  "search_keywords": "e.g. lofi chill retro nostalgic beats royalty free no copyright",\n'
            '  "genre_tags": ["lofi", "chill", "ambient", "retro"],\n'
            '  "recommended_volume": 0.12,\n'
            '  "explanation": "Brief reason why this soundtrack fits the video"\n'
            "}"
        )
        try:
            raw = self._chat(system, user, json_mode=True)
            data = TextProvider.extract_json(raw)
            if not data or "search_keywords" not in data:
                return self._mock_music_recommendation(script_title, category)
            return data
        except Exception:
            return self._mock_music_recommendation(script_title, category)

    def _mock_music_recommendation(
        self, script_title: str, category: str | None = None
    ) -> dict[str, Any]:
        title_lower = script_title.lower()
        if any(w in title_lower for w in ["90s", "retro", "nostalgia", "yaad", "purane", "old", "video"]):
            return {
                "mood": "Nostalgic / Warm Lo-Fi",
                "search_keywords": "90s retro nostalgic chill lofi ambient beats no copyright",
                "genre_tags": ["lofi", "nostalgic", "retro", "chill"],
                "recommended_volume": 0.12,
                "explanation": "Matches the nostalgic storytelling tone without overpowering spoken narration.",
            }
        if any(w in title_lower for w in ["tech", "ai", "coding", "software", "future", "modern"]):
            return {
                "mood": "Modern Tech / Upbeat Ambient",
                "search_keywords": "modern tech ambient electronic synth beats royalty free",
                "genre_tags": ["tech", "electronic", "ambient", "modern"],
                "recommended_volume": 0.10,
                "explanation": "Provides a clean, innovative tech feel that keeps listeners engaged.",
            }
        if any(w in title_lower for w in ["mystery", "horror", "dark", "secret", "crime", "story"]):
            return {
                "mood": "Cinematic Suspense / Deep Ambient",
                "search_keywords": "cinematic suspense dark ambient mystery background music no copyright",
                "genre_tags": ["suspense", "cinematic", "mystery", "ambient"],
                "recommended_volume": 0.14,
                "explanation": "Builds intrigue and dramatic tension for mysterious storytelling.",
            }
        return {
            "mood": "Inspiring Chill / Acoustic Calm",
            "search_keywords": "calm inspirational acoustic piano chill background music royalty free",
            "genre_tags": ["acoustic", "calm", "inspirational", "piano"],
            "recommended_volume": 0.12,
            "explanation": "Warm and pleasant accompaniment suitable for general informative videos.",
        }


ai_service = AIService()

