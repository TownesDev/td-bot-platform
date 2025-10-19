# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/db/package*.json ./packages/db/
COPY packages/types/package*.json ./packages/types/
COPY packages/feature-sdk/package*.json ./packages/feature-sdk/
COPY apps/bot-runner/package*.json ./apps/bot-runner/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY packages/db ./packages/db
COPY packages/types ./packages/types
COPY packages/feature-sdk ./packages/feature-sdk
COPY apps/bot-runner ./apps/bot-runner

# Build packages
WORKDIR /app/packages/db
RUN npm run build

WORKDIR /app/packages/types
RUN npm run build

WORKDIR /app/packages/feature-sdk
RUN npm run build

WORKDIR /app/apps/bot-runner
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy built application
COPY --from=builder /app/apps/bot-runner/dist ./dist
COPY --from=builder /app/apps/bot-runner/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bot -u 1001

# Change ownership and switch to non-root user
RUN chown -R bot:nodejs /app
USER bot

# Health check (via process monitoring)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD pgrep node || exit 1

# Start the application
CMD ["node", "dist/index.js"]