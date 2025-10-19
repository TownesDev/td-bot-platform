# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/db/package*.json ./packages/db/
COPY packages/types/package*.json ./packages/types/
COPY apps/api/package*.json ./apps/api/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY packages/db ./packages/db
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Build packages
WORKDIR /app/packages/db
RUN npm run build

WORKDIR /app/packages/types
RUN npm run build

WORKDIR /app/apps/api
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install curl for healthchecks
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S api -u 1001

# Change ownership and switch to non-root user
RUN chown -R api:nodejs /app
USER api

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]