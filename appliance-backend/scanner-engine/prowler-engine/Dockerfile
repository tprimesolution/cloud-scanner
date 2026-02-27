# Prowler engine - runs Prowler rules via direct Python import (no CLI)
FROM python:3.12-slim

WORKDIR /app

# Install build deps for Prowler (lz4, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential \
    && rm -rf /var/lib/apt/lists/*

# Clone Prowler into prowler-core
ENV PROWLER_CORE=/app/prowler-core
RUN git clone --depth 1 https://github.com/prowler-cloud/prowler.git /app/prowler-core \
    && pip install --no-cache-dir -e /app/prowler-core

# Install prowler-engine
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY prowler_engine ./prowler_engine

# Remove build deps
RUN apt-get purge -y git build-essential && apt-get autoremove -y

EXPOSE 8001

ENV PROWLER_CORE=/app/prowler-core
CMD ["python", "-m", "uvicorn", "prowler_engine.server:app", "--host", "0.0.0.0", "--port", "8001"]
