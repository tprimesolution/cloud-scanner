#!/bin/sh
set -e
# Run migrations as root (Prisma needs write access to engines)
npx prisma migrate deploy
# Drop to app user for the main process
exec su-exec app node dist/main.js
