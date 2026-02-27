# syntax=docker/dockerfile:1.7
# Prowler engine - runs Prowler rules via direct Python import (no CLI)

FROM alpine/git:2.47.2 AS prowler-src
ARG PROWLER_REF=master
RUN git clone --depth 1 --branch "${PROWLER_REF}" https://github.com/prowler-cloud/prowler.git /app/prowler-core

FROM python:3.12-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

COPY --from=prowler-src /app/prowler-core /app/prowler-core
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -e /app/prowler-core && \
    apt-get purge -y build-essential && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

COPY prowler_engine ./prowler_engine

EXPOSE 8001
ENV PROWLER_CORE=/app/prowler-core
CMD ["python", "-m", "uvicorn", "prowler_engine.server:app", "--host", "0.0.0.0", "--port", "8001"]
