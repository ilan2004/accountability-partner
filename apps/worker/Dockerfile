# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies using npm (simpler than pnpm for Railway)
RUN npm install --production

# Copy source code
COPY . .

# Create auth directory for WhatsApp
RUN mkdir -p auth-temp

# Set environment
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
