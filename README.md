# YouTube Content Studio

AI-powered YouTube content creation platform that runs entirely on your local machine. Automates the full video production pipeline from idea generation to export-ready packages for manual YouTube upload.

## Pipeline

```
Trending Topic → Ideas → Script → Scenes → Images → Voice → Video → Thumbnail → SEO → Export
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Backend | FastAPI (Python) |
| Database | MySQL 8 |
| Storage | Local file system |
| AI | OpenAI (GPT-4o-mini, DALL-E 3, TTS) |
| Video | FFmpeg |

## Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **MySQL 8** (or use Docker Compose)
- **FFmpeg** (for video assembly)
- **OpenAI API key** (optional — mock data used without it)

## Quick Start

### 1. Start MySQL

```bash
docker compose up -d
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux
```

Edit `backend/.env` and set your `OPENAI_API_KEY` if available.

```bash
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 3. Frontend Setup (separate hosting)

The frontend lives in `frontend/` and is designed to be hosted independently from the backend.

```bash
cd frontend
npm install
copy .env.example .env   # Windows
npm run dev
```

UI: http://localhost:5173

For production, build and deploy the `frontend/dist/` folder to your static host. See [frontend/README.md](frontend/README.md).

## Project Structure

```
Youtube-Automation/
├── backend/           # FastAPI application
│   └── app/
│       ├── models/    # SQLAlchemy models
│       ├── schemas/   # Pydantic schemas
│       ├── routers/   # API endpoints
│       └── services/  # Business logic (AI, FFmpeg, storage)
├── frontend/          # React UI (host separately — see frontend/README.md)
├── projects/          # Generated project files
├── assets/            # Shared assets (music, characters, etc.)
├── exports/           # Export packages for YouTube upload
├── templates/         # Reusable templates
└── logs/              # Application logs
```

Each project gets its own folder:

```
projects/my-video/
├── script/
├── scenes/
├── images/
├── audio/
├── video/
├── thumbnail/
└── metadata/
```

## API Endpoints

| Module | Endpoint | Description |
|--------|----------|-------------|
| Projects | `GET/POST /api/projects` | CRUD project management |
| Ideas | `POST /api/ideas/project/{id}/generate` | Generate trending ideas |
| Scripts | `POST /api/scripts/project/{id}/generate` | Generate full script |
| Scenes | `POST /api/scenes/project/{id}/generate` | Break script into scenes |
| Images | `POST /api/images/project/{id}/generate-all` | Generate scene images |
| Voice | `POST /api/voice/project/{id}/generate-all` | Generate TTS audio |
| Video | `POST /api/video/project/{id}/build` | Assemble video with FFmpeg |
| Thumbnails | `POST /api/thumbnails/project/{id}/generate` | Generate thumbnails |
| SEO | `POST /api/seo/project/{id}/generate` | Generate metadata |
| Export | `POST /api/export/project/{id}` | Package for upload |

## Workflow

1. **Create a project** from the dashboard
2. **Generate ideas** — AI suggests trending video topics
3. **Select an idea** and **generate a script** (hook, body, ending)
4. **Generate scenes** — script split into narrated segments with image prompts
5. **Generate images & voice** for all scenes
6. **Build video** — FFmpeg combines everything into 1080p MP4
7. **Generate thumbnails** and **SEO metadata**
8. **Export** — everything packaged in `exports/` for manual YouTube upload

## Configuration

Environment variables in `backend/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `mysql+pymysql://youtube:youtube@localhost:3306/youtube_studio?charset=utf8mb4` | MySQL connection |
| `OPENAI_API_KEY` | (empty) | OpenAI API key for AI features |
| `STORAGE_ROOT` | `../projects` | Project files directory |
| `FFMPEG_PATH` | `ffmpeg` | Path to FFmpeg binary |
| `DEFAULT_LANGUAGE` | `en` | Default content language |

## Mock Mode

Without an OpenAI API key, the app runs in **mock mode** with sample data for ideas, scripts, scenes, and SEO. Images are generated as styled placeholders. Voice files are minimal placeholders. Set `OPENAI_API_KEY` for full AI generation.

## Future Enhancements

- AWS S3 storage
- Background job queue (Celery/SQS)
- Automatic YouTube uploads
- Analytics dashboard
- Multi-user authentication
- Team collaboration

## License

MIT
