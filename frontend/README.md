# YouTube Content Studio — Frontend

Standalone React UI for the YouTube Content Studio. Host this separately from the FastAPI backend.

## Setup

```bash
npm install
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux
```

Edit `.env` and set your backend URL:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## Development

```bash
npm run dev
```

Runs at http://localhost:5173. Vite proxies `/api` to the backend during local dev.

## Production Build

```bash
npm run build
npm run preview
```

Static files are output to `dist/`. Deploy that folder to any static host:

- Vercel
- Netlify
- Cloudflare Pages
- Nginx / Apache
- S3 + CloudFront

## Backend CORS

When hosting the frontend on a different domain, add its URL to the backend `.env`:

```env
CORS_ORIGINS=http://localhost:5173,https://your-frontend-domain.com
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | Yes (production) | Full backend API base URL including `/api` |

## Project Structure

```
frontend/
├── src/
│   ├── api/          # API client
│   ├── components/   # Shared UI components
│   ├── pages/        # Dashboard & project workflow
│   └── types/        # TypeScript types
├── .env.example
├── package.json
└── vite.config.ts
```
