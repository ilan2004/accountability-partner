# Use Node.js 20 LTS (required for WhatsApp Baileys library)
FROM node:20-alpine

# Install unzip for auth file extraction
RUN apk add --no-cache unzip

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies like tsx)
RUN npm install

# Copy source code
COPY . .

# Create auth directory for WhatsApp
RUN mkdir -p auth-temp

# Set environment
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
