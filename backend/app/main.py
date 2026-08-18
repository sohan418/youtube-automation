import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import PromptTemplate
from app.routers import admin, ai, export, ideas, images, media, projects, prompts, scenes, scene_videos, scripts, seo, thumbnails, timeline, video, voice

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_default_prompts()
    yield


def _seed_default_prompts():
    from app.routers.admin import DEFAULT_PROMPTS
    db = SessionLocal()
    try:
        for key, defaults in DEFAULT_PROMPTS.items():
            existing = db.query(PromptTemplate).filter(PromptTemplate.key == key).first()
            if not existing:
                db.add(PromptTemplate(
                    key=key,
                    label=defaults["label"],
                    system=defaults["system"],
                    user=defaults["user"],
                ))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


app = FastAPI(
    title="YouTube Content Studio",
    description="AI-powered local YouTube content creation pipeline",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(ideas.router, prefix="/api")
app.include_router(scripts.router, prefix="/api")
app.include_router(scenes.router, prefix="/api")
app.include_router(scene_videos.router, prefix="/api")
app.include_router(images.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(video.router, prefix="/api")
app.include_router(timeline.router, prefix="/api")
app.include_router(thumbnails.router, prefix="/api")
app.include_router(seo.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(prompts.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "YouTube Content Studio",
        "version": "0.1.0",
    }
