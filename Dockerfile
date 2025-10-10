# Use Debian-based Node image for Prisma compatibility
FROM node:22

# Work in the worker app directory
WORKDIR /app/apps/worker

# Copy only package manifests first for better caching
COPY apps/worker/package*.json ./
COPY apps/worker/prisma ./prisma

# Install dependencies, include dev so tsx is available at runtime
RUN npm ci --include=dev

# Copy the rest of the worker source code
COPY apps/worker ./

# Generate Prisma client (no DB connection required)
RUN npx prisma generate

# Expose nothing (background worker)
ENV NODE_ENV=production

# Start the worker - run prisma db push first, then start the app
CMD ["sh", "-c", "echo '[startup] Running Prisma DB push...' && npx prisma db push && echo '[startup] Starting worker...' && exec tsx src/index.ts"]

