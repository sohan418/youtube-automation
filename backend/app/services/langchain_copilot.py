import json
import logging
from typing import Any
from sqlalchemy.orm import Session

try:
    from langchain_core.prompts import ChatPromptTemplate
except ImportError:
    ChatPromptTemplate = None

from app.database import SessionLocal
from app.models import Project, Script, Scene, SceneImage, Timeline
from app.services.ai import ai_service
from app.services.voice import voice_service
from app.services.image import image_service
from app.services.video import video_service
from app.services.youtube import youtube_service

logger = logging.getLogger(__name__)

# Project Chat History Storage: { project_id: [ { "role": "user"|"assistant", "content": "..." } ] }
PROJECT_CHAT_HISTORIES: dict[int, list[dict[str, str]]] = {}


class LangChainCopilotAgent:
    """Interactive LangChain AI Video Copilot Agent for studio chat assistance."""

    def __init__(self, project_id: int):
        self.project_id = project_id

    def get_history(self) -> list[dict[str, str]]:
        if self.project_id not in PROJECT_CHAT_HISTORIES:
            PROJECT_CHAT_HISTORIES[self.project_id] = [
                {
                    "role": "assistant",
                    "content": "Namaste! I am your AI Video Production Copilot. How can I help you edit your script, scenes, voiceover, or video today?",
                }
            ]
        return PROJECT_CHAT_HISTORIES[self.project_id]

    def clear_history(self) -> list[dict[str, str]]:
        PROJECT_CHAT_HISTORIES[self.project_id] = [
            {
                "role": "assistant",
                "content": "Namaste! Chat history cleared. How can I help you edit your script, scenes, voiceover, or video today?",
            }
        ]
        return PROJECT_CHAT_HISTORIES[self.project_id]

    def _get_project_context(self, db: Session) -> str:
        project = db.query(Project).filter(Project.id == self.project_id).first()
        if not project:
            return "Project not found."

        script = db.query(Script).filter(Script.project_id == self.project_id).order_by(Script.created_at.desc()).first()
        scenes = db.query(Scene).filter(Scene.project_id == self.project_id).order_by(Scene.order_index).all()

        context_lines = [
            f"Project Name: {project.name}",
            f"Category: {project.category}",
            f"Language: {project.language}",
            f"Aspect Ratio: {project.ratio}",
        ]

        if script:
            context_lines.append(f"Script Title: {script.title}")
            context_lines.append(f"Script Hook: {script.hook}")
            context_lines.append(f"Script Body: {script.body[:300]}...")
        else:
            context_lines.append("Script: None created yet.")

        context_lines.append(f"Total Scenes in Current Project: {len(scenes)}")
        for idx, sc in enumerate(scenes, 1):
            context_lines.append(f"  Scene {idx} (ID {sc.id}): Narration: '{sc.narration[:80]}' (Prompt: '{sc.image_prompt[:60] if sc.image_prompt else 'None'}')")

        # Include Channel Recent Uploads / YouTube History Context
        try:
            recent_vids = youtube_service.fetch_recent_videos(max_results=10)
            if recent_vids:
                context_lines.append("\nUser Channel Recent Uploads / Video History (10 Recent Videos):")
                for idx, v in enumerate(recent_vids[:10], 1):
                    title = v.get("title", "")
                    desc = (v.get("description", "") or "")[:100]
                    pub = v.get("published_at", "")
                    context_lines.append(f"  {idx}. Title: '{title}' | Upload Date: {pub} | Info: {desc}")
        except Exception as err:
            logger.warning("Could not append recent videos to copilot context: %s", err)

        return "\n".join(context_lines)

    async def chat(self, user_message: str) -> dict[str, Any]:
        history = self.get_history()
        history.append({"role": "user", "content": user_message})

        db: Session = SessionLocal()
        state_modified = False
        action_taken = None

        try:
            project_context = self._get_project_context(db)

            # Build System Prompt with Full Context
            system_prompt = (
                "You are an expert YouTube Video Production Copilot AI Assistant. "
                "You help users refine scripts, generate scenes, manage channel history, and produce videos. "
                "You understand English, Hindi, and Hinglish. Be helpful, concise, friendly, and precise.\n\n"
                "Current Project & Channel History Context:\n"
                f"{project_context}\n\n"
                "Guidance:\n"
                "1. If user asks about their recent videos, last uploaded video, or channel history, answer directly using the provided Video History context!\n"
                "2. If user asks to add a scene or modify a scene, explain clearly what changes were made.\n"
                "3. Respond in the user's preferred language (Hindi/Hinglish/English)."
            )

            # Format conversation history
            conv_str = ""
            for msg in history[-6:]:
                conv_str += f"{msg['role'].capitalize()}: {msg['content']}\n"

            formatted_user = f"Conversation History:\n{conv_str}\nUser Request: {user_message}"

            # Check for direct script/scene/history modification intents
            msg_lower = user_message.lower()

            if "script" in msg_lower and any(k in msg_lower for k in ["save", "save kar", "create", "set", "use", "apply"]):
                from app.models import ProjectStatus
                project = db.query(Project).filter(Project.id == self.project_id).first()
                if project:
                    # Look at recent conversation history to parse script & scenes
                    recent_assistant_msg = ""
                    for msg in reversed(history[:-1]):
                        if msg["role"] == "assistant" and len(msg["content"]) > 100:
                            recent_assistant_msg = msg["content"]
                            break

                    parsed_script = ai_service._generate_json(
                        system="You are an assistant that extracts structured script details from text. Return JSON: {\"title\": \"...\", \"hook\": \"...\", \"body\": \"...\", \"ending\": \"...\", \"scenes\": [{\"narration\": \"...\", \"image_prompt\": \"...\"}]}",
                        user=f"Extract script title, hook, body, ending, and scene breakdown from this context:\n\n{recent_assistant_msg or user_message}",
                        label="Extract Script & Scenes"
                    )

                    db.query(Scene).filter(Scene.project_id == project.id).delete()
                    db.query(Script).filter(Script.project_id == project.id).delete()
                    db.commit()

                    script_obj = Script(
                        project_id=project.id,
                        title=parsed_script.get("title", f"{project.name} Script"),
                        hook=parsed_script.get("hook", ""),
                        body=parsed_script.get("body", ""),
                        ending=parsed_script.get("ending", ""),
                        language=project.language or "en",
                        is_active=True
                    )
                    db.add(script_obj)
                    db.commit()
                    db.refresh(script_obj)

                    scenes_list = parsed_script.get("scenes", [])
                    created_scenes = []
                    for idx, sc in enumerate(scenes_list, 1):
                        scene_item = Scene(
                            project_id=project.id,
                            script_id=script_obj.id,
                            order_index=idx,
                            narration=sc.get("narration", ""),
                            image_prompt=sc.get("image_prompt", f"Cinematic scene {idx} illustration"),
                            video_prompt=sc.get("video_prompt"),
                            sound_effect=sc.get("sound_effect"),
                            transition=sc.get("transition", "crossfade"),
                            duration_seconds=6.0
                        )
                        db.add(scene_item)
                        created_scenes.append(scene_item)

                    project.status = ProjectStatus.SCENES
                    db.commit()
                    state_modified = True
                    action_taken = "script_and_scenes_saved"

                    reply = (
                        f"📜 **Script & {len(created_scenes)} Scenes Safaltapurvak Database Mein Save Ho Gaye Hain!**\n\n"
                        f"• **Title**: {script_obj.title}\n"
                        f"• **Hook**: \"{script_obj.hook[:100]}...\"\n"
                        f"• **Total Scenes**: {len(created_scenes)}\n\n"
                        f"Aap Studio screen ke **Script** aur **Scenes** tabs mein inhe live dekh kar edit kar sakte hain!"
                    )
                else:
                    reply = "Script save karne ke liye active project nahi mila."

            elif any(k in msg_lower for k in ["save", "save kar", "db m save", "db me save", "add to idea", "save idea", "ideas save", "save kar do"]):
                from app.models import Idea, ProjectStatus
                project = db.query(Project).filter(Project.id == self.project_id).first()
                if project:
                    # Look at recent assistant message in conversation history for ideas
                    recent_assistant_msg = ""
                    for msg in reversed(history[:-1]):
                        if msg["role"] == "assistant":
                            recent_assistant_msg = msg["content"]
                            break

                    raw_ideas = []
                    if recent_assistant_msg and ("1." in recent_assistant_msg or "2." in recent_assistant_msg):
                        try:
                            # Dynamically extract ideas from the assistant's previous message
                            parsed = ai_service._generate_json(
                                system="You are an assistant that extracts structured video ideas from text. Return JSON: {\"ideas\": [{\"title\": \"...\", \"description\": \"...\", \"category\": \"...\"}]}",
                                user=f"Extract all video ideas listed in this text:\n\n{recent_assistant_msg}",
                                label="Extract Ideas from Context"
                            )
                            raw_ideas = parsed.get("ideas", [])
                        except Exception as parse_err:
                            logger.warning(f"Could not parse context ideas: {parse_err}")

                    # Fallback to generating brand new dynamic ideas using channel context if none extracted
                    if not raw_ideas:
                        recent_vids = youtube_service.fetch_recent_videos(max_results=10)
                        raw_ideas = ai_service.generate_ideas(
                            category=project.category or "Technology",
                            count=5,
                            language=project.language or "en",
                            topic=user_message if len(user_message) > 10 else project.name,
                            recent_videos=recent_vids or None,
                        )

                    saved_titles = []
                    for item in raw_ideas:
                        title = item.get("title", "Untitled Idea").strip()
                        desc = item.get("description", "").strip()
                        cat = item.get("category", project.category or "Technology")
                        score = item.get("trending_score", 90)

                        if title:
                            existing = db.query(Idea).filter(Idea.project_id == project.id, Idea.title == title).first()
                            if not existing:
                                db.add(Idea(project_id=project.id, title=title, description=desc, category=cat, trending_score=score))
                            saved_titles.append(title)

                    project.status = ProjectStatus.IDEA
                    db.commit()
                    state_modified = True
                    action_taken = "ideas_saved"

                    reply = (
                        f"✅ **{len(saved_titles)} Dynamic Video Ideas Have Been Saved to Your Database (Idea Bank)!**\n\n"
                        f"**Saved Ideas:**\n"
                    )
                    for i, t in enumerate(saved_titles, 1):
                        reply += f"{i}. **{t}**\n"
                    reply += "\nYou can view and select any of these ideas from the **Ideas Tab** in your Studio interface!"
                else:
                    reply = "Save karne ke liye active project nahi mila."

            elif any(k in msg_lower for k in ["last video", "pichli video", "pichhli video", "upload ki", "kon si upload", "kaun si upload", "recent video", "channel history", "youtube history"]):
                recent_vids = youtube_service.fetch_recent_videos(max_results=10)
                if recent_vids:
                    top_vid = recent_vids[0]
                    title = top_vid.get("title", "")
                    desc = (top_vid.get("description", "") or "").strip()
                    reply = (
                        f"📹 **Aapki Last Uploaded Video:**\n"
                        f"**{title}**\n\n"
                        f"**Aapke Channel Ki Top Recent Videos History:**\n"
                    )
                    for i, v in enumerate(recent_vids[:5], 1):
                        reply += f"{i}. **{v.get('title', '')}**\n"
                else:
                    reply = "Mujhe aapke channel ki recent video history nahi mili."

            elif "hook" in msg_lower and ("make" in msg_lower or "change" in msg_lower or "punch" in msg_lower or "better" in msg_lower or "badlo" in msg_lower):
                script = db.query(Script).filter(Script.project_id == self.project_id).order_by(Script.created_at.desc()).first()
                if not script:
                    project = db.query(Project).filter(Project.id == self.project_id).first()
                    topic = project.name if project else "YouTube Automation"
                    gen_script = ai_service._generate_json(
                        system="You are a YouTube scriptwriter. Output JSON with title, hook, body, ending.",
                        user=f"Write script for topic: {topic}"
                    )
                    script = Script(
                        project_id=self.project_id,
                        title=gen_script.get("title", f"{topic} Guide"),
                        hook=gen_script.get("hook", f"Here is what you need to know about {topic}!"),
                        body=gen_script.get("body", "Welcome to this guide."),
                        ending=gen_script.get("ending", "Subscribe for more!")
                    )
                    db.add(script)
                    db.commit()

                new_hook = ai_service.complete(
                    system="Rewrite this YouTube hook to be extremely engaging and punchy (15-20 words). Return ONLY text.",
                    prompt=f"Current Hook: {script.hook}\nTopic context: {script.title}"
                )
                script.hook = new_hook.strip()
                db.commit()
                state_modified = True
                action_taken = "script_updated"
                reply = f"I've updated your script hook to be more engaging:\n\n✨ **New Hook**: \"{script.hook}\""

            elif ("add" in msg_lower and "scene" in msg_lower) or "scene add" in msg_lower or "new scene" in msg_lower or "extra scene" in msg_lower:
                project = db.query(Project).filter(Project.id == self.project_id).first()
                if not project:
                    project = db.query(Project).first()
                    if project:
                        self.project_id = project.id

                if project:
                    script = db.query(Script).filter(Script.project_id == project.id).order_by(Script.created_at.desc()).first()
                    if not script:
                        script = Script(
                            project_id=project.id,
                            title=project.name,
                            body="Video script"
                        )
                        db.add(script)
                        db.commit()
                        db.refresh(script)

                    scenes = db.query(Scene).filter(Scene.project_id == project.id).order_by(Scene.order_index).all()
                    next_index = len(scenes) + 1

                    generated_narration = ai_service.complete(
                        system="You are a YouTube director. Generate ONE concise Hindi/Hinglish narration sentence for a new video scene based on the user prompt.",
                        prompt=f"User request: {user_message}\nProject topic: {script.title}"
                    ).strip()

                    new_scene = Scene(
                        project_id=project.id,
                        script_id=script.id,
                        order_index=next_index,
                        narration=generated_narration,
                        image_prompt=f"Cinematic video scene illustration: {generated_narration[:100]}",
                        duration_seconds=5.0
                    )
                    db.add(new_scene)
                    db.commit()
                    state_modified = True
                    action_taken = "scene_added"
                    reply = f"🎬 **Scene {next_index} Naya Scene Add Ho Gaya Hai!**\n\n• **Narration**: \"{generated_narration}\"\n• **Visual Prompt**: Cinematic visual for Scene {next_index}"
                else:
                    reply = "Pehle ek project create karein fir scenes add karein."

            elif "render" in msg_lower or "build video" in msg_lower or "make video" in msg_lower:
                project = db.query(Project).filter(Project.id == self.project_id).first()
                if project:
                    from app.services.langchain_producer import launch_producer_agent_bg
                    launch_producer_agent_bg(
                        project_id=self.project_id,
                        topic=project.name,
                        category=project.category or "Technology",
                        language=project.language,
                    )
                    state_modified = True
                    action_taken = "render_started"
                    reply = "⚡ I have launched the Autonomous LangChain Producer Agent to create your full video! You can monitor progress in the Auto-Produce modal."
                else:
                    reply = "Project not found to start render."

            else:
                # Conversational AI Completion with Full Channel Context
                reply = ai_service.complete(
                    system=system_prompt,
                    prompt=formatted_user,
                    json_mode=False
                )

            history.append({"role": "assistant", "content": reply})

            return {
                "reply": reply,
                "history": history,
                "state_modified": state_modified,
                "action_taken": action_taken,
            }

        except Exception as exc:
            logger.error(f"LangChain Copilot error: {exc}", exc_info=True)
            err_msg = f"Sorry, I encountered an issue processing your request: {exc}"
            history.append({"role": "assistant", "content": err_msg})
            return {
                "reply": err_msg,
                "history": history,
                "state_modified": False,
                "action_taken": None,
            }
        finally:
            db.close()
