# TownesDev Bot Platform

A comprehensive bot development platform with API services, bot runner, and feature SDK.

## Quick Start

### Service Management

The platform includes easy-to-use npm scripts for managing services:

```bash
# Check if API is running
npm run status:api

# Check full platform status (API + processes)
npm run status

# Stop all services
npm run stop

# Start services in background (PowerShell job)
npm run start:bg

# Stop background services
npm run stop:bg

# Restart services
npm run restart
```

### Development

```bash
# Start all services for development
npm start

# Run tests
npm test

# Build the platform
npm run build
```

## Architecture

- **API Server** (`apps/api/`): REST API for bot management
- **Bot Runner** (`apps/bot-runner/`): Executes bot logic
- **Database** (`packages/db/`): Prisma-based data layer
- **Feature SDK** (`packages/feature-sdk/`): Reusable bot features
- **Types** (`packages/types/`): Shared TypeScript types

## Scripts

- `scripts/status.js`: Comprehensive status checker
- `scripts/status-api.js`: Quick API health check
- `scripts/stop.js`: Service termination script

## Logs

Service logs are written to `logs/platform.log` when running in background mode.
