import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import ai, export, ideas, images, media, projects, scenes, scripts, seo, thumbnails, video, voice

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


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

app.include_router(projects.router, prefix="/api")
app.include_router(ideas.router, prefix="/api")
app.include_router(scripts.router, prefix="/api")
app.include_router(scenes.router, prefix="/api")
app.include_router(images.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(video.router, prefix="/api")
app.include_router(thumbnails.router, prefix="/api")
app.include_router(seo.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(media.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "YouTube Content Studio",
        "version": "0.1.0",
    }
