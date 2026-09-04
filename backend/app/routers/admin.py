from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PromptTemplate

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Default prompts (seeded on first run) ───────────────────────────

DEFAULT_PROMPTS = {
    "ideas": {
        "label": "Video Ideas",
        "system": (
            "You are a YouTube trend analyst. Generate video ideas for long-form "
            "YouTube content. Ideas should be in-depth, informative, and suited for "
            "5-15 minute videos that encourage watch time and engagement."
        ),
        "user": (
            "Generate 5 trending YouTube video ideas. "
            "Language: {language}. "
            "Each idea should be suitable for a 5-15 minute long-form video (16:9). "
            "Focus on topics that allow deep dives, tutorials, storytelling, or comprehensive guides. "
            'Return JSON: {"ideas": [{"title": "...", "description": "...", '
            '"category": "...", "trending_score": 0-100}]}'
        ),
    },
    "ideas_shorts": {
        "label": "Video Ideas (Shorts)",
        "system": (
            "You are a YouTube Shorts trend analyst. Generate video ideas optimized "
            "for short-form vertical content (60 seconds or less). Ideas must be "
            "punchy, attention-grabbing, and suited for quick consumption. Each idea "
            "should have a strong hook that works in the first 2 seconds."
        ),
        "user": (
            "Generate 5 trending YouTube Shorts video ideas. "
            "Language: {language}. "
            "Each idea should be suitable for a 60-second vertical video (9:16). "
            "Focus on quick tips, surprising facts, hacks, satisfying content, or viral trends. "
            'Return JSON: {"ideas": [{"title": "...", "description": "...", '
            '"category": "...", "trending_score": 0-100}]}'
        ),
    },
    "script": {
        "label": "Script",
        "system": (
            "You are an expert YouTube scriptwriter. Write engaging, well-structured "
            "scripts for long-form YouTube videos (5-15 minutes). Use a clear "
            "structure with a compelling hook, detailed body sections, and a "
            "satisfying ending. Keep viewers engaged throughout with pacing "
            "variety and storytelling techniques."
        ),
        "user": (
            "Write a 5-10 minute YouTube script about: {topic}. "
            "Language: {language}. Include hook, body, and ending. "
            "The hook should grab attention in the first 5-10 seconds. "
            "Break the body into 3-4 clear sections. End with a memorable conclusion and CTA. "
            'Return JSON: {"title": "...", "hook": "...", "body": "...", "ending": "..."}'
        ),
    },
    "script_shorts": {
        "label": "Script (Shorts)",
        "system": (
            "You are an expert YouTube Shorts & Reels scriptwriter. Write ultra-concise, "
            "high-impact scripts for vertical short videos up to 90 seconds. Hook the viewer in "
            "the first 1-3 seconds. Use fast pacing, relatable examples, and short punchy sentences."
        ),
        "user": (
            "Write a YouTube Shorts script (up to 90 seconds total, max 12 scenes) about: {topic}.\n"
            "Language: {language}.\n\n"
            "REQUIRED SCRIPT FLOW STRUCTURE:\n"
            "1. Starting Hook (1-3 sec): High-impact opening statement/question to stop the scroll.\n"
            "2. Example / Visual Scenario: A fast, relatable visual example or scenario.\n"
            "3. Short Explanation: Concise core explanation & key takeaways.\n"
            "4. End Hook & Closing: Brief closing statement leading directly into the mandatory ending CTA.\n\n"
            "MANDATORY ENDING SCENE:\n"
            "The 'ending' field MUST ALWAYS be exactly:\n"
            "\"वीडियो पसंद आया हो तो Like, Share और Subscribe जरूर करें!\" (or target language equivalent).\n\n"
            "Word count: Keep total narration under 200 words (~90 seconds spoken).\n"
            'Return JSON: {"title": "...", "hook": "...", "body": "...", "ending": "वीडियो पसंद आया हो तो Like, Share और Subscribe जरूर करें!"}'
        ),
    },
    "scenes": {
        "label": "Scenes",
        "system": (
            "You are a video director. Break scripts into scenes as JSON. "
            "Each scene has a 'narration', an 'image_prompt', and a 'video_prompt'. "
            "Narrations are spoken voice-over text ONLY — never include instructions, "
            "JSON, or any metadata in them. Keep each narration short (one or two "
            "sentences). If a section of the script is long, split it into multiple scenes. "
            "Write every narration in the requested language; image prompts stay in English. "
            "Both the image_prompt and video_prompt MUST always mention the aspect ratio "
            "'{ratio}' so every scene stays consistent."
        ),
        "user": (
            "Break this script into scenes. Each scene needs narration, an image prompt, "
            "and a video prompt.\n\n"
            "Language: {language}\n\n"
            "Aspect ratio: {ratio}\n\n"
            "Write all narrations in {language}.\n\n"
            "Split the script into a natural number of scenes based on the content.\n\n"
            "Hook: {hook}\n\nBody: {body}\n\nEnding: {ending}\n\n"
            'Return ONLY valid JSON: {"scenes": [{"narration": "...", "image_prompt": "...", "video_prompt": "..."}]}'
        ),
    },
    "scenes_shorts": {
        "label": "Scenes (Shorts)",
        "system": (
            "You are a YouTube Shorts video director. Break scripts into quick, "
            "visually dynamic scenes for a 9:16 vertical video. Each scene is 3-8 "
            "seconds long with a single punchy narration line. Narrations are spoken "
            "voice-over ONLY — never include instructions, JSON, or metadata. "
            "Image prompts must describe bold, close-up, vertically-framed compositions "
            "that grab attention on a phone screen. Keep every prompt in English. "
            "Both image_prompt and video_prompt MUST mention the 9:16 vertical aspect ratio."
        ),
        "user": (
            "Break this Shorts script into MAX 12 SCENES for a ~90-second Short video.\n\n"
            "Language: {language}\n\n"
            "Aspect ratio: 9:16 (vertical / Shorts)\n\n"
            "SCENE FLOW STRUCTURE (Max 12 scenes total):\n"
            "- Scene 1: Starting Hook (1-3 seconds)\n"
            "- Scene 2: Example / Visual scenario\n"
            "- Scenes 3-11: Short Explanation breakdown\n"
            "- Final Scene (Scene 12): MANDATORY ENDING CTA: \"वीडियो पसंद आया हो तो Like, Share और Subscribe जरूर करें!\" (or target language equivalent).\n\n"
            "Hook: {hook}\n\nBody: {body}\n\nEnding: {ending}\n\n"
            'Return ONLY valid JSON: {"scenes": [{"narration": "...", "image_prompt": "...", "video_prompt": "..."}]}'
        ),
    },
    "seo": {
        "label": "SEO",
        "system": "You are a YouTube SEO expert. Generate metadata as JSON.",
        "user": (
            "Generate SEO metadata for a YouTube video.\nTitle: {title}\n"
            "Script excerpt: {script_excerpt}\nLanguage: {language}\n"
            'Return JSON: {"title": "...", "description": "...", "tags": "...", "hashtags": "..."}'
        ),
    },
    "seo_shorts": {
        "label": "SEO (Shorts)",
        "system": (
            "You are a YouTube Shorts SEO expert. Generate metadata optimized for "
            "Shorts discovery. Titles should be short and clickable (under 50 chars). "
            "Descriptions should be concise and hashtag-driven."
        ),
        "user": (
            "Generate SEO metadata for a YouTube Short.\nTitle: {title}\n"
            "Script excerpt: {script_excerpt}\nLanguage: {language}\n"
            "Keep title under 50 characters. Focus on trending Shorts hashtags. "
            'Return JSON: {"title": "...", "description": "...", "tags": "...", "hashtags": "..."}'
        ),
    },
    "thumbnail": {
        "label": "Thumbnail",
        "system": (
            "You are an expert YouTube thumbnail designer and AI prompt engineer. "
            "Create ONE detailed, high-CTR image prompt in English for generating a YouTube thumbnail. "
            "Describe the subject, high-emotion facial expressions, vibrant color palette, dynamic lighting, "
            "and a bold, high-CTR text caption overlay (2-4 short, punchy words in 3D typography or glowing text matching the video topic, e.g., 'DON'T DO THIS!', 'SECRET REVEALED!', 'STOP NOW!'). "
            "CRITICAL INSTRUCTION: Output ONLY the plain text prompt itself. Do NOT include markdown headers, bold asterisks (**), "
            "hashtags (#), code block ticks (```), emojis, or introductory labels like 'Thumbnail Prompt:'."
        ),
        "user": (
            "Create a 16:9 widescreen thumbnail image prompt for a YouTube video titled/about: '{title}'. "
            "Include a high-CTR bold 2-4 word text caption overlay that matches this video topic."
        ),
    },
    "thumbnail_shorts": {
        "label": "Thumbnail (Shorts)",
        "system": (
            "You are an expert YouTube Shorts thumbnail designer and AI prompt engineer. "
            "Create ONE detailed, eye-catching image prompt in English for a 9:16 vertical thumbnail. "
            "Thumbnails for Shorts are tall and narrow — design for mobile-first viewing. "
            "Use bold close-up subjects, high-contrast colors, and a short high-CTR bold text caption overlay (2-3 punchy words, e.g. 'MUST SEE!', 'INSANE!'). "
            "CRITICAL: Output ONLY the plain text prompt itself. No markdown, no bold, "
            "no hashtags, no code blocks, no emojis, no labels."
        ),
        "user": (
            "Create a 9:16 vertical thumbnail image prompt for a YouTube Short titled/about: '{title}'. "
            "Design for mobile phone screens with bold close-up imagery and a high-impact 2-3 word CTR text caption overlay."
        ),
    },
    "image": {
        "label": "Image Generation",
        "system": (
            "You are an expert image prompt engineer for AI art generation. "
            "Create ONE detailed image prompt in English that visually shows what the "
            "scene's narration is describing. Describe concrete visual imagery: setting, "
            "subject, objects, mood, and lighting. Output only the prompt itself. "
            "No text, no words, no watermarks, no labels. Cinematic, ultra detailed, "
            "{ratio} aspect ratio."
        ),
        "user": (
            "Scene narration: [paste your scene narration here]\n"
            "Create a detailed cinematic image prompt that visualizes this scene. "
            "Always include the {ratio} aspect ratio."
        ),
    },
    "image_shorts": {
        "label": "Image Generation (Shorts)",
        "system": (
            "You are an expert image prompt engineer for AI art generation. "
            "Create ONE detailed image prompt in English for a 9:16 vertical composition. "
            "Design bold, close-up, phone-screen-optimized visuals that grab attention. "
            "Describe concrete imagery: subject, mood, lighting, colors. "
            "Output only the prompt itself. No text, no words, no watermarks. "
            "Cinematic, ultra detailed, 9:16 vertical aspect ratio."
        ),
        "user": (
            "Scene narration: [paste your scene narration here]\n"
            "Create a detailed 9:16 vertical cinematic image prompt for this Shorts scene. "
            "Bold, close-up, mobile-optimized composition. Always include 9:16 aspect ratio."
        ),
    },
}


# ── Pydantic schemas ────────────────────────────────────────────────

class PromptOut(BaseModel):
    key: str
    label: str
    system: str
    user: str

    class Config:
        from_attributes = True


class PromptUpdate(BaseModel):
    system: str
    user: str


class BulkPromptUpdate(BaseModel):
    prompts: dict[str, PromptUpdate]


# ── Routes ──────────────────────────────────────────────────────────

@router.get("/prompts")
def list_prompts(db: Session = Depends(get_db)):
    rows = db.query(PromptTemplate).order_by(PromptTemplate.id).all()
    return [PromptOut.model_validate(r) for r in rows]


@router.put("/prompts/{key}")
def update_prompt(key: str, body: PromptUpdate, db: Session = Depends(get_db)):
    row = db.query(PromptTemplate).filter(PromptTemplate.key == key).first()
    if not row:
        raise HTTPException(404, f"Prompt '{key}' not found")
    row.system = body.system
    row.user = body.user
    db.commit()
    db.refresh(row)
    return PromptOut.model_validate(row)


@router.put("/prompts")
def bulk_update_prompts(body: BulkPromptUpdate, db: Session = Depends(get_db)):
    updated = []
    for key, data in body.prompts.items():
        row = db.query(PromptTemplate).filter(PromptTemplate.key == key).first()
        if row:
            row.system = data.system
            row.user = data.user
            updated.append(key)
    db.commit()
    return {"updated": updated}


@router.post("/prompts/seed")
def seed_prompts(db: Session = Depends(get_db)):
    seeded = []
    for key, defaults in DEFAULT_PROMPTS.items():
        existing = db.query(PromptTemplate).filter(PromptTemplate.key == key).first()
        if not existing:
            db.add(PromptTemplate(
                key=key,
                label=defaults["label"],
                system=defaults["system"],
                user=defaults["user"],
            ))
            seeded.append(key)
    db.commit()
    return {"seeded": seeded}


@router.post("/prompts/reset")
def reset_prompts(db: Session = Depends(get_db)):
    """Reset all prompts back to defaults."""
    db.query(PromptTemplate).delete()
    db.commit()
    for key, defaults in DEFAULT_PROMPTS.items():
        db.add(PromptTemplate(
            key=key,
            label=defaults["label"],
            system=defaults["system"],
            user=defaults["user"],
        ))
    db.commit()
    return {"status": "ok", "reset": len(DEFAULT_PROMPTS)}
