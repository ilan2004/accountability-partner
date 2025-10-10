#!/bin/bash
echo "[entrypoint] Current working directory: $(pwd)"
echo "[entrypoint] DATABASE_URL is set: ${DATABASE_URL:+Yes}"
echo "[entrypoint] DATABASE_URL length: ${#DATABASE_URL}"
echo "[entrypoint] Running Prisma DB push..."
npx prisma db push
RESULT=$?
if [ $RESULT -eq 0 ]; then
  echo "[entrypoint] Prisma DB push completed successfully"
else
  echo "[entrypoint] ERROR: Prisma DB push failed!"
  echo "[entrypoint] Please check your DATABASE_URL and database connectivity"
  exit 1
fi
echo "[entrypoint] Starting worker..."
exec tsx src/index.ts
