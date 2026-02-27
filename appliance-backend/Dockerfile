# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .
RUN npm run build
RUN npx prisma generate
RUN npm prune --omit=dev && npm install prisma

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV CLOUDSPLOIT_DIR=/opt/cloudsploit

# CloudSploit (Node) + Prowler metadata for sync (scans run via prowler-engine HTTP)
RUN apk add --no-cache git su-exec openssl && \
    git clone --depth 1 https://github.com/prowler-cloud/prowler.git /opt/prowler-core && \
    git clone --depth 1 https://github.com/aquasecurity/cloudsploit.git /opt/cloudsploit && \
    cd /opt/cloudsploit && npm install --omit=dev

# Minimal footprint
RUN addgroup -g 1001 -S app && adduser -S app -u 1001 -G app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
RUN chown -R app:app /app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health/ready || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
