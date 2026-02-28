# syntax=docker/dockerfile:1.7
# Shield engine wrapper - runs upstream Prowler rules via direct Python import (no CLI)

FROM alpine/git:2.47.2 AS prowler-src
ARG SHIELD_REF=master
RUN git clone --depth 1 --branch "${SHIELD_REF}" https://github.com/prowler-cloud/prowler.git /app/shield-core && \
    rm -rf /app/shield-core/.git

FROM python:3.12-slim AS builder
ENV VENV_PATH=/opt/venv
ENV PATH="${VENV_PATH}/bin:${PATH}"
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m venv "${VENV_PATH}"
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY --from=prowler-src /app/shield-core /app/shield-core
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir /app/shield-core

FROM python:3.12-slim AS runtime
ENV VENV_PATH=/opt/venv
ENV PATH="${VENV_PATH}/bin:${PATH}"
WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --from=prowler-src /app/shield-core /app/shield-core

COPY prowler_engine ./prowler_engine

EXPOSE 8001
ENV SHIELD_CORE=/app/shield-core
ENV PROWLER_CORE=/app/shield-core
CMD ["python", "-m", "uvicorn", "prowler_engine.server:app", "--host", "0.0.0.0", "--port", "8001"]
