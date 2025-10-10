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

# Copy entrypoint to run migrations at container start, then start app
COPY apps/worker/entrypoint.sh /app/apps/worker/entrypoint.sh
RUN chmod +x /app/apps/worker/entrypoint.sh

# Expose nothing (background worker)
ENV NODE_ENV=production

# Start the worker via entrypoint (runs prisma db push, then tsx)
CMD ["/bin/sh", "/app/apps/worker/entrypoint.sh"]

