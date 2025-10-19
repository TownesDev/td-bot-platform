# TownesDev Bot Platform - Operations Guide

## Environment Setup

### Required Environment Variables

```bash
# Discord Application
DISCORD_TOKEN=your-discord-bot-token          # Required: Discord bot token
APPLICATION_ID=your-discord-app-id             # Required: Discord application ID

# Database & Cache
DATABASE_URL=postgresql://user:pass@host:5432/db  # Required: PostgreSQL connection
REDIS_URL=redis://localhost:6379               # Required: Redis connection

# TownesDev Licensing
TOWNESDEV_LICENSE=trial_placeholder            # Required: Platform license key
LICENSE_SERVER_BASE=http://localhost:3000      # Required: License validation endpoint

# Application Configuration
NODE_ENV=development                           # Optional: production/development
LOG_LEVEL=info                                # Optional: debug/info/warn/error
PORT=3000                                     # Optional: API server port
HOST=0.0.0.0                                 # Optional: API server host
```

## Quick Start

```bash
# 1. Clone and install dependencies
git clone <repository>
cd td-bot-platform
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your values

# 3. Set up database
npm run db:push    # Push schema to database
npm run db:generate # Generate Prisma client

# 4. Start development servers
npm run dev        # Starts both API and bot-runner
```

- PostgreSQL ≥ 14
- Redis ≥ 7
- pnpm or npm

### 2. Environment

Copy `.env.example` → `.env` and fill in your Discord credentials.

### 3. Database

```bash
npx prisma migrate dev --name init
```

### 4. Run Services

```bash
# in separate terminals or tmux panes
npm run dev:api      # Fastify API (auth, licensing, billing)
npm run dev:runner   # Discord bot runner (shards + commands)
npm run dev:workers  # BullMQ workers
```

### 5. Docker (optional local stack)

```bash
docker compose up -d
```

The compose file spins up Postgres + Redis containers for you.

---

## ⚙️ Licensing System

The bot platform hosts its own `/licenses/activate` and `/licenses/refresh` endpoints.
The TownesDev web app simply consumes these for displaying plan, features, and trial status.

- **Activation Flow**

  1. `bot-runner` sends `POST /licenses/activate` with `TOWNESDEV_LICENSE`.
  2. API verifies and returns plan info + feature flags.
  3. Runner caches and refreshes periodically.

---

## 🐳 Deployment Targets

| Service    | Purpose           | Notes                               |
| ---------- | ----------------- | ----------------------------------- |
| api        | Public HTTP layer | Linode or Vercel Function target    |
| bot-runner | Discord gateway   | Run on a VM with long-lived process |
| workers    | Background jobs   | Queue-based; share Redis connection |

---

## 🛠 Maintenance

- **Backups** – nightly `pg_dump` of `townesdev_bot`.
- **Logs** – JSON via pino; ship to Sentry or Loki.
- **Migrations** – all DB changes via Prisma; record rationale in `/docs/MIGRATIONS.md`.

---

## 🧹 Offboarding & Export

- `POST /exports` → generates encrypted backup of Tenant & Guild data.
- `POST /imports` → restores into new environment (used for self-host or migration).
- Data retention: 30–60 days after account termination, then purge.

---

## 🧾 Changelog Policy

Every merged PR must update `/CHANGELOG.md` with:

```md
## [0.x.y] – YYYY-MM-DD

### Added

### Changed

### Fixed

### Removed
```

---

_Last updated:_ _{{today’s date}}_
