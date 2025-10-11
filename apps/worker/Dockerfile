# Use Node.js 20 LTS (required for WhatsApp Baileys library)
FROM node:20-alpine

# Install unzip for auth file extraction
RUN apk add --no-cache unzip

# Set working directory to worker app
WORKDIR /app

# Copy worker package files
COPY package*.json ./

# Install all dependencies (including devDependencies like tsx)
RUN npm install

# Copy worker source code
COPY . ./

# Create auth directory for WhatsApp (mapped to volume)
RUN mkdir -p /app/auth

# Set environment
ENV NODE_ENV=production

# Start the worker application
CMD ["npm", "start"]
