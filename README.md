# AI Interview Assistant

Practice job interviews with AI-powered feedback, voice transcription, and real-time camera analysis. This repository contains a **Flask backend** (full Gemini interview flow) and a **React frontend** (Create React App UI).

## Features

- AI-driven mock interviews with dynamic follow-up questions (Gemini)
- Speech-to-text via OpenAI Whisper
- Neural text-to-speech for Hindi/Hinglish (edge-tts)
- Camera and microphone setup with permission handling
- Real-time confidence, clarity, and fluency scoring
- Interview history, settings, and feedback dashboard
- User authentication and language preferences (Flask app)
- React SPA with device testing and interview flow

## Tech Stack

| Layer | Technology |
|-------|------------|
| **React frontend** | React 19, Create React App, Framer Motion, Lucide React |
| **Flask app (primary UI)** | Flask, Jinja templates, vanilla JavaScript |
| **Backend API** | Python, Flask-CORS, OpenAI Whisper, Google Gemini |
| **Database** | SQLite |
| **Styling** | Custom CSS utilities (Tailwind-like classes, not Tailwind CSS) |

**Detected:** React ✅ · Create React App ✅ · Vite ❌ · Next.js ❌ · TypeScript ❌ · Tailwind CSS ❌ (utility classes in `App.css`)

## Project Structure

```
AI_Interview_Assistant/
├── backend/           # Flask API + AI services
├── frontend/          # React app (Vercel deployment target)
├── templates/         # Flask HTML templates (primary production UI)
├── static/            # Flask CSS/JS assets
├── .env.example       # Backend environment template
└── render.yaml        # Optional backend deploy on Render
```

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **Google Gemini API key** — [Get one here](https://aistudio.google.com/apikey)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/AI_Interview_Assistant.git
cd AI_Interview_Assistant
```

### 2. Backend setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Copy environment variables:

```bash
# From project root
copy ..\.env.example ..\.env        # Windows
cp ../.env.example ../.env          # macOS / Linux
```

Edit `.env` and set your `GEMINI_API_KEY`.

### 3. Frontend setup

```bash
cd ../frontend
npm install
cp .env.example .env
```

## Run Locally

**Terminal 1 — Backend (port 5000):**

```bash
cd backend
venv\Scripts\activate          # Windows
python app.py
```

**Terminal 2 — React frontend (port 3000):**

```bash
cd frontend
npm start
```

| App | URL |
|-----|-----|
| Flask (full features) | http://127.0.0.1:5000/landing |
| React UI | http://localhost:3000 |

The React app uses `REACT_APP_API_URL` in production. Locally, `package.json` `"proxy"` forwards API calls to `http://localhost:5000`.

## Environment Variables

### Backend (`.env` at project root or `backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `GEMINI_MODEL` | No | Default: `gemini-2.0-flash` |
| `FLASK_SECRET_KEY` | Yes (prod) | Random string for sessions |
| `PORT` | No | Server port (default `5000`) |
| `FLASK_DEBUG` | No | Set `false` in production |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | Yes (prod) | Backend URL, e.g. `https://your-api.onrender.com` |

> **Never commit `.env` files.** Use `.env.example` as a template only.

## Production Build

```bash
cd frontend
npm run build
```

Output is in `frontend/build/`. Test locally:

```bash
npx serve -s build
```

## Deployment

The React frontend and Flask backend deploy separately. Vercel hosts the static React build; the backend needs a Python host (Render, Railway, Fly.io) because it runs Whisper, SQLite, and long-lived processes.

### Step 1 — Deploy backend (Render)

1. Push this repo to GitHub.
2. On [Render](https://render.com), create a **Web Service** from the repo.
3. Set **Root Directory** to `backend`.
4. **Build command:** `pip install -r requirements.txt`
5. **Start command:** `python app.py`
6. Add environment variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `FLASK_SECRET_KEY`, `FLASK_DEBUG=false`
7. Copy the public URL (e.g. `https://ai-interview-assistant-api.onrender.com`).

Alternatively, import `render.yaml` as a Render Blueprint.

### Step 2 — Deploy frontend (Vercel)

1. Import the GitHub repo on [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Create React App** (auto-detected).
4. Add environment variable:
   - `REACT_APP_API_URL` = your Render backend URL (no trailing slash)
5. Deploy.

`frontend/vercel.json` configures SPA routing and static asset caching.

### One public link

- **React on Vercel** → shareable UI link (e.g. `https://your-app.vercel.app`)
- **Backend on Render** → API must be reachable; set `REACT_APP_API_URL` so transcription works

For the **full Flask experience** (auth, Gemini interview, Hindi TTS, history) from one URL, deploy only the Flask backend and use `/landing` — no Vercel required.

## Push to GitHub

```bash
cd AI_Interview_Assistant
git init
git add .
git status
git commit -m "Prepare AI Interview Assistant for GitHub and production deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/AI_Interview_Assistant.git
git push -u origin main
```

Verify `.env` is **not** listed in `git status` before committing.

## Deploy on Vercel (CLI)

```bash
npm i -g vercel
cd frontend
vercel
vercel env add REACT_APP_API_URL
vercel --prod
```

## Scripts Reference

| Command | Location | Description |
|---------|----------|-------------|
| `npm start` | `frontend/` | Dev server |
| `npm run build` | `frontend/` | Production build |
| `python app.py` | `backend/` | Start Flask API |

## License

MIT (or your chosen license)
