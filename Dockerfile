# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
# Use npm install instead of npm ci since package-lock.json might not exist
RUN npm install --omit=dev && npm cache clean --force

# Copy application files
COPY . .

# Create logs directory (optional)
RUN mkdir -p logs

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S tunneler -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R tunneler:nodejs /app

# Switch to non-root user
USER tunneler

# Expose the port the app runs on
EXPOSE 3000

# Health check to ensure container is running properly
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "index.js"]