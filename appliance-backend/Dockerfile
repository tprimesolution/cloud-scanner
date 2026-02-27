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
ARG PROWLER_REF=master
RUN git clone --depth 1 --branch "${PROWLER_REF}" https://github.com/prowler-cloud/prowler.git /opt/prowler-core

FROM node:20-alpine AS cloudsploit-src
ARG CLOUDSPLOIT_REF=master
RUN apk add --no-cache git
RUN git clone --depth 1 --branch "${CLOUDSPLOIT_REF}" https://github.com/aquasecurity/cloudsploit.git /opt/cloudsploit
WORKDIR /opt/cloudsploit
RUN --mount=type=cache,target=/root/.npm \
    (npm ci --omit=dev || npm install --omit=dev) && \
    npm cache clean --force

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV CLOUDSPLOIT_DIR=/opt/cloudsploit

RUN apk add --no-cache su-exec openssl && \
    addgroup -g 1001 -S app && \
    adduser -S app -u 1001 -G app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=cloudsploit-src /opt/cloudsploit /opt/cloudsploit
COPY --from=prowler-metadata /opt/prowler-core /opt/prowler-core
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R app:app /app /opt/cloudsploit /opt/prowler-core

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:8080/api/health/ready || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
