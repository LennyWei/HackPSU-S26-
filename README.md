# HackPSU-S26-

A small multiplayer-style battle demo built for HackPSU.

- Backend: Flask (Python)
- Frontend: Next.js (React + TypeScript)

## Features
- Turn-based combat engine in `backend/game_engine.py`
- Flask API in `backend/app.py`
- Next.js frontend with animated UI in `frontend/app`
- Audio and assets in `frontend/public`

## Quickstart (Docker)
Recommended: run both services with Docker Compose.

```bash
docker-compose up --build
```

This builds and starts the `backend` and `frontend` services. Open the frontend at http://localhost:3000 (default Next.js port).

## Quickstart (local, no Docker)

Backend:

```bash
cd backend
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate
pip install -r requirements.txt
set FLASK_APP=app.py
flask run --port 5000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

## Environment
- The repo uses environment variables for configuration. Copy `.env.example` to `.env` and fill in your values. Never commit your real `.env` file.
- Required (example):

```
# Gemini API key (required for services using Gemini)
GEMINI_API_KEY=your_gemini_api_key_here

# Backend (example)
# FLASK_ENV=development
# SECRET_KEY=replace_with_a_secret

# Frontend (example)
# NEXT_PUBLIC_API_URL=http://localhost:5000
```

- Backend environment variables are read by the Flask app; frontend config is in `next.config.js`.

## Project structure (top-level)

- `backend/` — Flask API, game engine, models, Dockerfile
- `frontend/` — Next.js app, components, assets, Dockerfile
- `docker-compose.yml` — brings up both services

## Development notes
- Backend code entry: `backend/app.py`
- Game logic: `backend/game_engine.py`
- Frontend pages: `frontend/app/*` (Next.js app router)
- Static assets: `frontend/public/`

## Contributing
- Create issues or pull requests with clear descriptions.
- Run linters and tests (if any) before opening a PR.

## License
MIT — feel free to reuse and adapt.

---