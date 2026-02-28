# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
# Keep runtime dependencies minimal and install Prisma CLI for migrate deploy.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev && \
    npm install prisma --no-save

FROM alpine/git:2.47.2 AS prowler-metadata
ARG SHIELD_REF=master
RUN git clone --depth 1 --branch "${SHIELD_REF}" https://github.com/prowler-cloud/prowler.git /opt/shield-core

FROM node:20-alpine AS guard-src
ARG GUARD_REF=master
RUN apk add --no-cache git
RUN git clone --depth 1 --branch "${GUARD_REF}" https://github.com/aquasecurity/cloudsploit.git /opt/guard-core
WORKDIR /opt/guard-core
RUN --mount=type=cache,target=/root/.npm \
    (npm ci --omit=dev || npm install --omit=dev) && \
    npm cache clean --force && \
    rm -rf /opt/guard-core/.git /opt/guard-core/.github /opt/guard-core/docs /opt/guard-core/test /opt/guard-core/tests

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV GUARD_DIR=/opt/guard-core

RUN apk add --no-cache su-exec openssl && \
    addgroup -g 1001 -S app && \
    adduser -S app -u 1001 -G app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=guard-src /opt/guard-core /opt/guard-core
COPY --from=prowler-metadata /opt/shield-core /opt/shield-core
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R app:app /app /opt/guard-core /opt/shield-core

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:8080/api/health/ready || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
