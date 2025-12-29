# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Install build dependencies for potential native modules
RUN apk add --no-cache python3 make g++

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies with verbose logging and error handling
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set audit false && \
    npm config set fund false && \
    npm install --omit=dev --verbose && \
    npm cache clean --force

# Copy application files
COPY . .

# Create logs and config directories
RUN mkdir -p logs config

# Copy startup script
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

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

# Use startup script as entrypoint to process HTML templates
ENTRYPOINT ["/app/startup.sh"]

# Start the application
CMD ["node", "index.js"]
