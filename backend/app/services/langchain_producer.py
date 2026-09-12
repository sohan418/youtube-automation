import asyncio
import json
import logging
from typing import Any, TypedDict
from sqlalchemy.orm import Session

try:
    from langchain_core.prompts import ChatPromptTemplate
    from langgraph.graph import StateGraph, START, END
except ImportError:
    ChatPromptTemplate = None
    StateGraph = None
    START = "START"
    END = "END"

from app.database import SessionLocal
from app.models import Project, Script, Scene, SceneImage, Timeline
from app.services.ai import ai_service
from app.services.voice import voice_service
from app.services.image import image_service
from app.services.video import video_service

logger = logging.getLogger(__name__)

# Global state memory for live task monitoring
PRODUCER_TASKS: dict[int, dict[str, Any]] = {}


class ProducerState(TypedDict, total=False):
    project_id: int
    topic: str
    category: str
    language: str
    duration_minutes: int
    hitl_mode: bool
    current_stage: str
    progress: float
    logs: list[str]
    script_id: int | None
    script_data: dict[str, Any]
    scenes_data: list[dict[str, Any]]
    voice_urls: list[str]
    media_urls: list[str]
    export_id: int | None
    video_url: str | None
    error: str | None


class LangChainProducerAgent:
    """Autonomous AI Video Producer Agent powered by LangChain & LangGraph with HITL Checkpoints."""

    def __init__(
        self,
        project_id: int,
        topic: str,
        category: str = "Technology",
        language: str = "en",
        duration_minutes: int = 3,
        hitl_mode: bool = True,
    ):
        self.project_id = project_id
        self.topic = topic
        self.category = category
        self.language = language
        self.duration_minutes = duration_minutes
        self.hitl_mode = hitl_mode

        self.voice_service = voice_service
        self.image_service = image_service
        self.video_service = video_service

        # State tracking
        self.current_state: ProducerState | None = None

        # Build LangGraph State Machine
        self.graph = self._build_graph()

    def _build_graph(self):
        builder = StateGraph(ProducerState)

        # Add Pipeline Nodes
        builder.add_node("script_node", self._script_node)
        builder.add_node("scene_breakdown_node", self._scene_breakdown_node)
        builder.add_node("voiceover_node", self._voiceover_node)
        builder.add_node("visuals_node", self._visuals_node)
        builder.add_node("timeline_node", self._timeline_node)
        builder.add_node("render_node", self._render_node)

        # Flow Connections
        builder.add_edge(START, "script_node")
        builder.add_edge("script_node", "scene_breakdown_node")
        builder.add_edge("scene_breakdown_node", "voiceover_node")
        builder.add_edge("voiceover_node", "visuals_node")
        builder.add_edge("visuals_node", "timeline_node")
        builder.add_edge("timeline_node", "render_node")
        builder.add_edge("render_node", END)

        return builder.compile()

    def _update_status(self, stage: str, progress: float, log_msg: str):
        logger.info(f"[LangChainAgent Project {self.project_id}] [{stage}] ({progress}%): {log_msg}")
        if self.project_id not in PRODUCER_TASKS:
            PRODUCER_TASKS[self.project_id] = {
                "project_id": self.project_id,
                "status": "running",
                "stage": stage,
                "progress": progress,
                "logs": [],
                "error": None,
                "video_url": None,
            }
        PRODUCER_TASKS[self.project_id]["stage"] = stage
        PRODUCER_TASKS[self.project_id]["progress"] = progress
        PRODUCER_TASKS[self.project_id]["logs"].append(f"[{stage}] {log_msg}")

    # -------------------------------------------------------------------------
    # Graph Nodes
    # -------------------------------------------------------------------------

    async def _script_node(self, state: ProducerState) -> ProducerState:
        self._update_status("Script Generation", 15.0, "Generating video script using LangChain ChatPromptTemplate...")
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert YouTube scriptwriter. Write a compelling script for a {duration}-minute video."),
            ("user", "Topic: {topic}\nCategory: {category}\nLanguage: {language}\n\nReturn structured JSON with 'title', 'hook', 'body', and 'ending'.")
        ])
        
        formatted = prompt.format(duration=self.duration_minutes, topic=self.topic, category=self.category, language=self.language)
        script_dict = ai_service._generate_json(
            system="You are an expert YouTube scriptwriter. Output JSON only.",
            user=formatted,
            label="LangChain Script Node"
        )
        
        script_id = None
        db: Session = SessionLocal()
        try:
            project = db.query(Project).filter(Project.id == self.project_id).first()
            if project:
                script_obj = db.query(Script).filter(Script.project_id == self.project_id, Script.is_active == True).first()
                if not script_obj:
                    script_obj = Script(
                        project_id=self.project_id,
                        title=script_dict.get("title", f"{self.topic} Guide"),
                        hook=script_dict.get("hook", ""),
                        body=script_dict.get("body", ""),
                        ending=script_dict.get("ending", ""),
                        language=self.language
                    )
                    db.add(script_obj)
                else:
                    script_obj.title = script_dict.get("title", script_obj.title)
                    script_obj.hook = script_dict.get("hook", script_obj.hook)
                    script_obj.body = script_dict.get("body", script_obj.body)
                    script_obj.ending = script_dict.get("ending", script_obj.ending)
                    script_obj.language = self.language
                db.commit()
                db.refresh(script_obj)
                script_id = script_obj.id
        finally:
            db.close()

        state["script_id"] = script_id
        state["script_data"] = script_dict
        state["current_stage"] = "Script Generation"
        state["progress"] = 25.0
        return state

    async def _scene_breakdown_node(self, state: ProducerState) -> ProducerState:
        self._update_status("Scene Decomposition", 30.0, "Decomposing script into visual scenes...")

        script_data = state.get("script_data", {})
        script_id = state.get("script_id")
        hook = script_data.get("hook", "")
        body = script_data.get("body", "")
        ending = script_data.get("ending", "")

        db: Session = SessionLocal()
        try:
            proj = db.query(Project).filter(Project.id == self.project_id).first()
            ratio = proj.ratio if proj and proj.ratio else "16:9"
            lang = proj.language if proj and proj.language else "en"
        finally:
            db.close()

        scenes_list = ai_service.generate_scenes(
            script_body=body,
            hook=hook,
            ending=ending,
            language=lang,
            ratio=ratio,
        )

        # Sync to DB
        db = SessionLocal()
        try:
            if not script_id:
                s_obj = db.query(Script).filter(Script.project_id == self.project_id).first()
                if s_obj:
                    script_id = s_obj.id

            db.query(Scene).filter(Scene.project_id == self.project_id).delete()
            db.commit()

            if script_id:
                created_scenes = []
                for idx, sc in enumerate(scenes_list, 1):
                    scene_obj = Scene(
                        project_id=self.project_id,
                        script_id=script_id,
                        order_index=idx,
                        narration=sc.get("narration", ""),
                        image_prompt=sc.get("image_prompt", ""),
                        video_prompt=sc.get("video_prompt", ""),
                        sound_effect=sc.get("sound_effect", ""),
                        transition=sc.get("transition", "crossfade"),
                        duration_seconds=5.0
                    )
                    db.add(scene_obj)
                    created_scenes.append(scene_obj)
                db.commit()
        finally:
            db.close()

        state["scenes_data"] = scenes_list
        state["current_stage"] = "Scene Decomposition"
        state["progress"] = 45.0
        return state

    async def _voiceover_node(self, state: ProducerState) -> ProducerState:
        self._update_status("Voiceover Generation", 55.0, "Generating AI voiceover audio for all scenes...")

        db: Session = SessionLocal()
        try:
            project = db.query(Project).filter(Project.id == self.project_id).first()
            scenes = db.query(Scene).filter(Scene.project_id == self.project_id).order_by(Scene.order_index).all()
            for scene in scenes:
                if scene.narration and scene.narration.strip():
                    voice_res = self.voice_service.generate_voice(
                        text=scene.narration,
                        language=self.language,
                        slug=project.slug if project else f"proj_{self.project_id}",
                        filename=f"scene_{scene.order_index:03d}.mp3"
                    )
                    if isinstance(voice_res, str):
                        scene.audio_path = voice_res
                    elif isinstance(voice_res, dict):
                        scene.audio_path = voice_res.get("audio_path")
            db.commit()
        except Exception as err:
            logger.warning(f"Voiceover node encountered warning: {err}")
        finally:
            db.close()

        state["current_stage"] = "Voiceover Generation"
        state["progress"] = 65.0
        return state

    async def _visuals_node(self, state: ProducerState) -> ProducerState:
        self._update_status("Visual Generation", 75.0, "Generating visual image assets for scenes...")

        db: Session = SessionLocal()
        try:
            project = db.query(Project).filter(Project.id == self.project_id).first()
            slug = project.slug if project else f"proj_{self.project_id}"
            ratio = project.ratio if project else "16:9"

            scenes = db.query(Scene).filter(Scene.project_id == self.project_id).order_by(Scene.order_index).all()
            for scene in scenes:
                img_path, prompt_used = self.image_service.generate_scene_image(
                    slug=slug,
                    scene_id=scene.id,
                    order_index=scene.order_index,
                    narration=scene.narration,
                    image_prompt=scene.image_prompt,
                    ratio=ratio
                )
                if img_path:
                    scene.image_path = img_path
                    scene_img = SceneImage(
                        scene_id=scene.id,
                        file_path=img_path,
                        source="generated",
                        position=0
                    )
                    db.add(scene_img)
            db.commit()
        except Exception as err:
            logger.warning(f"Visual generation encountered warning: {err}")
        finally:
            db.close()

        state["current_stage"] = "Visual Generation"
        state["progress"] = 85.0
        return state

    async def _timeline_node(self, state: ProducerState) -> ProducerState:
        self._update_status("Timeline Assembly", 90.0, "Building multi-track project timeline...")

        db: Session = SessionLocal()
        try:
            timeline_obj = db.query(Timeline).filter(Timeline.project_id == self.project_id).first()
            if not timeline_obj:
                timeline_obj = Timeline(project_id=self.project_id, data="{}")
                db.add(timeline_obj)
                db.commit()
        except Exception as err:
            logger.warning(f"Timeline node encountered warning: {err}")
        finally:
            db.close()

        state["current_stage"] = "Timeline Assembly"
        state["progress"] = 92.0
        return state

    async def _render_node(self, state: ProducerState) -> ProducerState:
        self._update_status("Video Rendering", 95.0, "Compiling final video render...")

        db: Session = SessionLocal()
        try:
            project = db.query(Project).filter(Project.id == self.project_id).first()
            if not project:
                raise ValueError("Project not found")

            # Call render or build video if needed
            render_res = self.video_service.build_video(slug=project.slug, ratio=project.ratio)
            video_url = render_res if isinstance(render_res, str) else (render_res.get("video_url") if isinstance(render_res, dict) else None)

            PRODUCER_TASKS[self.project_id]["status"] = "completed"
            PRODUCER_TASKS[self.project_id]["stage"] = "Completed"
            PRODUCER_TASKS[self.project_id]["progress"] = 100.0
            PRODUCER_TASKS[self.project_id]["video_url"] = video_url
            self._update_status("Completed", 100.0, f"Full video production finished successfully! Output: {video_url}")

            state["video_url"] = video_url
            state["current_stage"] = "Completed"
            state["progress"] = 100.0
        except Exception as err:
            logger.error(f"Video rendering node failed: {err}")
            PRODUCER_TASKS[self.project_id]["status"] = "failed"
            PRODUCER_TASKS[self.project_id]["error"] = str(err)
            state["error"] = str(err)
        finally:
            db.close()

        return state

    # -------------------------------------------------------------------------
    # Execution entrypoints & HITL Checkpoint Handlers
    # -------------------------------------------------------------------------

    async def run(self):
        initial_state: ProducerState = {
            "project_id": self.project_id,
            "topic": self.topic,
            "category": self.category,
            "language": self.language,
            "duration_minutes": self.duration_minutes,
            "hitl_mode": self.hitl_mode,
            "current_stage": "Starting",
            "progress": 0.0,
            "logs": [],
        }

        try:
            # Stage 1: Script Generation
            state = await self._script_node(initial_state)

            if self.hitl_mode:
                PRODUCER_TASKS[self.project_id]["status"] = "waiting_script_approval"
                PRODUCER_TASKS[self.project_id]["waiting_approval"] = True
                PRODUCER_TASKS[self.project_id]["approval_stage"] = "script"
                PRODUCER_TASKS[self.project_id]["saved_agent"] = self
                PRODUCER_TASKS[self.project_id]["saved_state"] = state
                self._update_status(
                    "Script Approval",
                    25.0,
                    "[HITL Checkpoint] Script generated! Paused for user review & approval.",
                )
                return

            # If HITL mode is False, continue directly to Visuals
            await self.continue_visuals_stage(state)

        except Exception as exc:
            logger.error(f"LangChain Agent pipeline failed for project {self.project_id}: {exc}", exc_info=True)
            PRODUCER_TASKS[self.project_id] = {
                "project_id": self.project_id,
                "status": "failed",
                "stage": "Failed",
                "progress": 0.0,
                "logs": [f"Error: {exc}"],
                "error": str(exc),
                "video_url": None,
            }

    async def continue_visuals_stage(self, state: ProducerState):
        """Continue execution after Script approval -> Scenes, Voiceover & Images."""
        try:
            PRODUCER_TASKS[self.project_id]["status"] = "running"
            PRODUCER_TASKS[self.project_id]["waiting_approval"] = False
            PRODUCER_TASKS[self.project_id]["approval_stage"] = None

            state = await self._scene_breakdown_node(state)
            state = await self._voiceover_node(state)
            state = await self._visuals_node(state)

            if self.hitl_mode:
                PRODUCER_TASKS[self.project_id]["status"] = "waiting_visuals_approval"
                PRODUCER_TASKS[self.project_id]["waiting_approval"] = True
                PRODUCER_TASKS[self.project_id]["approval_stage"] = "visuals"
                PRODUCER_TASKS[self.project_id]["saved_agent"] = self
                PRODUCER_TASKS[self.project_id]["saved_state"] = state
                self._update_status(
                    "Visuals Approval",
                    85.0,
                    "[HITL Checkpoint] Scenes, Voiceover & Images generated! Paused for user review & approval.",
                )
                return

            # If HITL mode is False, continue directly to Render
            await self.continue_render_stage(state)

        except Exception as exc:
            logger.error(f"Visuals stage failed for project {self.project_id}: {exc}", exc_info=True)
            PRODUCER_TASKS[self.project_id]["status"] = "failed"
            PRODUCER_TASKS[self.project_id]["error"] = str(exc)

    async def continue_render_stage(self, state: ProducerState):
        """Continue execution after Visuals approval -> Timeline Assembly & Final Render."""
        try:
            PRODUCER_TASKS[self.project_id]["status"] = "running"
            PRODUCER_TASKS[self.project_id]["waiting_approval"] = False
            PRODUCER_TASKS[self.project_id]["approval_stage"] = None

            state = await self._timeline_node(state)
            await self._render_node(state)

        except Exception as exc:
            logger.error(f"Render stage failed for project {self.project_id}: {exc}", exc_info=True)
            PRODUCER_TASKS[self.project_id]["status"] = "failed"
            PRODUCER_TASKS[self.project_id]["error"] = str(exc)


def launch_producer_agent_bg(
    project_id: int,
    topic: str,
    category: str = "Technology",
    language: str = "en",
    duration_minutes: int = 3,
    hitl_mode: bool = True,
):
    """Launch the LangChain Producer Agent as an async background task."""
    agent = LangChainProducerAgent(
        project_id=project_id,
        topic=topic,
        category=category,
        language=language,
        duration_minutes=duration_minutes,
        hitl_mode=hitl_mode,
    )
    asyncio.create_task(agent.run())


def resume_producer_agent_bg(project_id: int, stage: str = "script"):
    """Resume a paused LangChain Producer Agent checkpoint."""
    task_info = PRODUCER_TASKS.get(project_id)
    if not task_info:
        raise ValueError(f"No active auto-producer task found for project {project_id}")

    agent: LangChainProducerAgent = task_info.get("saved_agent")
    state: ProducerState = task_info.get("saved_state")

    if not agent or not state:
        raise ValueError(f"No saved agent state found to resume for project {project_id}")

    current_status = task_info.get("status")

    if current_status == "waiting_script_approval" or stage == "script":
        asyncio.create_task(agent.continue_visuals_stage(state))
        return {"status": "resumed", "next_stage": "Visuals & Voiceover Generation"}
    elif current_status == "waiting_visuals_approval" or stage == "visuals":
        asyncio.create_task(agent.continue_render_stage(state))
        return {"status": "resumed", "next_stage": "Timeline & Render"}
    else:
        raise ValueError(f"Producer task for project {project_id} is not waiting for approval (Status: {current_status})")
