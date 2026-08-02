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
            "First, let's cover the basics. Whether you're a beginner or already experienced, understanding the fundamentals of {topic} is essential to getting real results.\n\n"
            "Next, the core strategies. The most successful people in {topic} follow a simple framework: start small, stay consistent, and measure what works.\n\n"
            "Then, common mistakes. Most people fail in {topic} not because of lack of effort, but because of avoidable errors. We'll show you what to watch out for.\n\n"
            "Finally, tools and resources. You don't need expensive gear to succeed in {topic} — with the right approach, free tools are more than enough to get started.\n\n"
            "That wraps up this {minutes}-minute deep dive into {topic}. Remember: progress over perfection."
        ),
        "ending": (
            "If you enjoyed this guide on {topic}, hit subscribe for more content like this. "
            "Drop your questions in the comments — see you in the next one!"
        ),
    },
    "hi": {
        "title": "{topic} — 2026 ki Sampurna Guide",
        "hook": "Kya aap jante hain ki {topic} ke baare mein sab kuch badalne wala hai?",
        "body": (
            "Aaj hum {topic} ke baare mein gehrai se jaanenge.\n\n"
            "Pehle basics. Chahe aap beginner hon ya experienced, {topic} ke fundamentals samajhna sabse zaroori hai.\n\n"
            "Ab core strategies. {topic} mein successful log ek simple framework follow karte hain: chhote steps se shuru karo, consistent raho, aur jo kaam kare use measure karo.\n\n"
            "Phir common mistakes. Zyada tar log {topic} mein mehnat ki kami ki nahi, balki avoidable galtiyon ki wajah se fail hote hain.\n\n"
            "Aakhir mein, tools aur resources. {topic} mein kamyab hone ke liye mehenge instruments ki zaroorat nahi — sahi approach ke saath free tools hi kaafi hain.\n\n"
            "Isi ke saath {minutes} minute ki yah {topic} deep dive samapt hoti hai. Yaad rakhein: progress over perfection."
        ),
        "ending": (
            "Agar {topic} par yah guide pasand aayi ho, toh channel subscribe karein aur comments mein apne sawal poochhein. "
            "Agle video mein milte hain!"
        ),
    },
    "hinglish": {
        "title": "{topic}: The Complete 2026 Guide",
        "hook": "Kya aap jante hain ki {topic} ke baare mein sab kuch badalne wala hai?",
        "body": (
            "Aaj hum {topic} ke baare mein deep dive karenge.\n\n"
            "First, basics se shuru karte hain. Chahe aap beginner ho ya experienced, {topic} ke fundamentals clear hona sabse zaroori hai.\n\n"
            "Next, core strategies. {topic} mein successful log ek simple framework follow karte hain: chhote steps se shuru karo, consistent raho, aur jo kaam kare use measure karo.\n\n"
            "Then, common mistakes. Zyada tar log {topic} mein avoidable galtiyon ki wajah se fail hote hain — hum dikhayenge kya galtiyan avoid karni chahiye.\n\n"
            "Finally, tools aur resources. {topic} mein kamyab hone ke liye mehenge gear ki zaroorat nahi — sahi approach ke saath free tools hi kaafi hain.\n\n"
            "Bas itna hi! {minutes} minute ki yah {topic} deep dive yahan khatam hoti hai. Remember: progress over perfection."
        ),
        "ending": (
            "Agar {topic} par yah guide pasand aayi ho, toh subscribe karna mat bhoolna aur comments mein apne sawal poochho. "
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
        return "Mock AI response — set OPENAI_API_KEY for real generation."

    def generate_ideas(
        self, category: str | None, count: int, language: str
    ) -> list[dict[str, Any]]:
        category_text = f" in the '{category}' category" if category else ""
        system = "You are a YouTube trend analyst. Generate video ideas as JSON."
        user = (
            f"Generate {count} trending YouTube video ideas{category_text}. "
            f"Language: {language}. "
            'Return JSON: {"ideas": [{"title": "...", "description": "...", '
            '"category": "...", "trending_score": 0-100}]}'
        )
        raw = self._chat(system, user, json_mode=True)
        data = TextProvider.extract_json(raw)
        return data.get("ideas", [])

    def _mock_ideas(self, user: str) -> str:
        category_match = re.search(r"in the ['\"](.+?)['\"] category", user)
        category = category_match.group(1).strip() if category_match else "Technology"
        count_match = re.search(r"Generate (\d+) trending", user)
        count = int(count_match.group(1)) if count_match else 5

        ideas: list[dict[str, Any]] = []
        for title, description, score in _MOCK_IDEA_TEMPLATES[:count]:
            ideas.append(
                {
                    "title": title.format(category=category),
                    "description": description.format(category=category),
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
        ending = re.search(r"Ending:\s*(.*)$", user, re.DOTALL)
        hook = hook.group(1).strip() if hook else "Let's dive right in."
        body = body.group(1).strip() if body else "Today we're exploring this topic step by step."
        ending = ending.group(1).strip() if ending else "Subscribe for more content like this!"

        segments: list[str] = [hook]
        segments += [p.strip() for p in body.split("\n\n") if p.strip()]
        segments.append(ending)

        scenes = [
            {
                "narration": segment,
                "image_prompt": f"Cinematic visual illustrating: {segment[:120]}",
            }
            for segment in segments
        ]
        return json.dumps({"scenes": scenes})

    def generate_script(
        self,
        topic: str,
        language: str,
        target_duration_minutes: int,
    ) -> dict[str, str]:
        system = "You are an expert YouTube scriptwriter. Write engaging scripts as JSON."
        user = (
            f"Write a {target_duration_minutes}-minute YouTube script about: {topic}. "
            f"Language: {language}. Include hook, body, and ending. "
            'Return JSON: {"title": "...", "hook": "...", "body": "...", "ending": "..."}'
        )
        raw = self._chat(system, user, json_mode=True)
        return TextProvider.extract_json(raw)

    def generate_scenes(
        self,
        script_body: str,
        hook: str,
        ending: str,
        language: str = "en",
    ) -> list[dict[str, str]]:
        system = "You are a video director. Break scripts into scenes as JSON."
        user = (
            f"Break this script into scenes. Each scene needs narration and an image prompt.\n\n"
            f"Language: {language}\n\n"
            f"Hook: {hook}\n\nBody: {script_body}\n\nEnding: {ending}\n\n"
            'Return JSON: {"scenes": [{"narration": "...", "image_prompt": "..."}]}'
        )
        raw = self._chat(system, user, json_mode=True)
        data = TextProvider.extract_json(raw)
        return data.get("scenes", [])

    def generate_image_prompt(self, scene_narration: str, style: str | None = None) -> str:
        style_text = f" Style: {style}." if style else ""
        system = "You are an image prompt engineer for AI art generation."
        user = f"Create a detailed image prompt for: {scene_narration}{style_text}"
        return self._chat(system, user)

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

    def generate_seo(
        self, script_title: str, script_body: str, language: str
    ) -> dict[str, str]:
        system = "You are a YouTube SEO expert. Generate metadata as JSON."
        user = (
            f"Generate SEO metadata for a YouTube video.\nTitle: {script_title}\n"
            f"Script excerpt: {script_body[:500]}\nLanguage: {language}\n"
            'Return JSON: {"title": "...", "description": "...", "tags": "...", "hashtags": "..."}'
        )
        raw = self._chat(system, user, json_mode=True)
        return TextProvider.extract_json(raw)

    def generate_thumbnail_prompt(self, title: str, style: str | None = None) -> str:
        style_text = f" Style: {style}." if style else ""
        system = "You are a YouTube thumbnail designer."
        user = f"Create a thumbnail image prompt for video titled: {title}{style_text}"
        return self._chat(system, user)


ai_service = AIService()
