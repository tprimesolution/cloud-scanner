#!/bin/bash
# Build images with legacy docker build (no buildx required)
# Use when: compose build requires buildx 0.17.0 or later

set -e
cd "$(dirname "$0")"
PROJECT="deploy"

echo "[*] Building with legacy docker build..."

# Backend (shared by backend, celery-worker, celery-beat)
docker build -t ${PROJECT}-backend:latest -f ../backend/Dockerfile ../backend

# Frontend
docker build -t ${PROJECT}-frontend:latest \
  --build-arg NEXT_PUBLIC_API_BASE_URL=/api \
  -f ../frontend/Dockerfile ../frontend

echo "[*] Build complete. Starting services..."
docker-compose -f docker-compose.legacy.yml up -d
