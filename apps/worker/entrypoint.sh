#!/bin/sh
set -e

echo "[entrypoint] Running Prisma DB push..."
npx prisma db push

echo "[entrypoint] Starting worker..."
# Use npm start which runs: tsx src/index.ts
npm start

