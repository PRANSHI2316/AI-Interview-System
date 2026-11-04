# Multi-stage Dockerfile for AI-Interview-System
# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

COPY frontend/ ./
ENV CI=false \
    REACT_APP_API_URL=""
RUN npm run build

# Stage 2: Python Backend Runtime
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies including ffmpeg for Whisper and libsndfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU and Python dependencies
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code, templates, static assets, and built frontend
COPY backend/ ./backend/
COPY templates/ ./templates/
COPY static/ ./static/
COPY database/ ./database/
COPY --from=frontend-builder /app/frontend/build ./frontend/build

ENV PORT=5000 \
    FLASK_DEBUG=false \
    PYTHONUNBUFFERED=1

EXPOSE 5000

CMD ["gunicorn", "app:app", "--chdir", "backend", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "2", "--timeout", "180"]
