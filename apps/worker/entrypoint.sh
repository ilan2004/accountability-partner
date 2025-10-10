#!/bin/sh

echo "[entrypoint] Current working directory: $(pwd)"
echo "[entrypoint] DATABASE_URL is set: ${DATABASE_URL:+Yes}"
echo "[entrypoint] DATABASE_URL length: ${#DATABASE_URL}"

echo "[entrypoint] Running Prisma DB push..."
# Run with verbose output
npx prisma db push --accept-data-loss || {
  echo "[entrypoint] ERROR: Prisma DB push failed!"
  echo "[entrypoint] Please check your DATABASE_URL and database connectivity"
  exit 1
}

echo "[entrypoint] Prisma DB push completed successfully"
echo "[entrypoint] Starting worker..."
# Run the worker directly without npm start to avoid double db push
exec tsx src/index.ts

