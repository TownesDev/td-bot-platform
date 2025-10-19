# TownesDev Bot Platform — Agent Instructions

## Mission
Implement a production-ready Discord Bot Platform with:
- `apps/api` — Fastify REST/tRPC for auth (Discord OAuth), licensing, features, billing webhooks, exports/imports
- `apps/bot-runner` — discord.js shard manager, feature loader, per-guild command registry
- `apps/workers` — BullMQ jobs (analytics, AI calls, exports)
- `packages/db` — Prisma Postgres schema + migrations
- `packages/feature-sdk` — feature contract (register, migrate, enable/disable, events)
- `packages/features/*` — built-in features (welcome, xp, announcements, ai)
- `packages/types` — shared zod types / API client typings
- `packages/billing` — Stripe helpers (trials, add-ons, metered usage)
- `infra/docker` — Dockerfiles, docker-compose, healthchecks
- `docs` — ADRs, OpenAPI, operations, migrations policy

## Non-Goals
- Do NOT store bot runtime data in Sanity.
- Do NOT add marketing/ops schemas here (those live in the TownesDev web repo).

## Integration Contract (with TownesDev web)
- Provide a stable HTTP API + typed client (zod) for the web app.
- Expose endpoints for: listing assets (guilds), feature toggles, usage/analytics, incidents, export/import, billing state.
- Keep endpoints backwards-compatible; if breaking, bump version.

## Sources of Truth (MUST stay current)
1. `/packages/db/schema.prisma` — authoritative runtime model  
2. `/docs/API/openapi.yaml` — current API definition + examples  
3. `/docs/ADR/*` — one ADR per significant decision (why, options, decision, consequences)  
4. `/docs/OPERATIONS.md` — env vars, run, docker, backups, export/import, license  
5. `/CHANGELOG.md` — user-facing updates for each PR

## Security & Reliability
- Use least-privilege Discord scopes; return clear remediation hints when perms are missing.
- All webhooks signed + idempotent (Stripe, license pings).
- Sentry for errors; pino logs with tenant/guild tags; request IDs.
- All migrations idempotent; provide rollback notes in `/docs/MIGRATIONS.md`.

## Licensing & Hosting Modes
- On boot, `bot-runner` calls `/licenses/activate` with `TOWNESDEV_LICENSE`.
- API responds with plan, feature flags, limits (AI caps), and refresh interval.
- Support **Hosted** (TownsDev runs it) and **Self-host** (user runs Docker image) with the same binary.
- Implement `/exports` and `/imports` for state migration (self-host ↔ hosted).

## Offboarding (must implement)
Provide a guided flow:
- **Move to Self-host** — export → provide license/env → schedule retire → retire hosted runner
- **Remove Bot** — unregister commands, revoke license, purge after retention window
- **Non-payment** — grace period, read-only, export link, retire, purge window

## Observability & Ops
- Metrics to log: events processed, queue latency, shard heartbeats, AI tokens/day.
- Health endpoints for API, worker, runner.
- Admin support endpoints: replay last N events, regenerate license, anonymize tenant.

## Deliverables per PR (Definition of Done)
- Code + unit tests if applicable
- Updated OpenAPI / Prisma / ADRs / OPERATIONS
- Demo script in PR description (how to run & test)
- CHANGELOG entry (user-facing)

## Project Roadmap (EPICs → Issues)

### EPIC 1 — Foundation
- [ ] Monorepo scaffold, lint/tsconfig, CI
- [ ] Prisma schema v1: Tenant, Guild, Feature, GuildFeature, UsageCounter, AuditLog
- [ ] API auth: Discord OAuth (identify, guilds) + session
- [ ] License service: `/licenses/activate`, `/licenses/refresh`
- [ ] Bot runner v1: shard manager, per-guild slash registry, event bus
- [ ] Feature SDK v1 + features: **welcome**, **xp**
- [ ] Stripe: Base plan + 30-day trial + portal link; add-on placeholders
- [ ] Dockerfiles + compose + healthchecks
- [ ] Observability: Sentry + pino + request IDs
- [ ] Docs: OpenAPI stub + OPERATIONS + ADR-000 (Architecture)

### EPIC 2 — Differentiators
- [ ] Community Health Score (metrics, endpoint, daily job)
- [ ] AI Concierge: bridge stub, tone profile, daily token caps, usage metering
- [ ] Feature Marketplace endpoints: enable/disable with permission guards
- [ ] Export/Import: secure dump + restore; signed URLs; background jobs

### EPIC 3 — Admin & Ops
- [ ] Admin endpoints: tenants/guilds, incidents feed, migrations status
- [ ] Support tools: event replay, license regen, anonymize/export tenant
- [ ] Adoption & churn endpoints; status + changelog endpoints

## Public API (first stable slice)
- `POST /auth/discord/callback`  → login + tenant
- `GET  /tenants/:id/assets`     → list guilds w/ plan & feature flags
- `GET  /assets/:guildId`        → config, features, usage
- `POST /assets/:guildId/features/:key/enable`
- `POST /assets/:guildId/features/:key/disable`
- `GET  /usage/:guildId/daily`   → counters (events, ai_tokens)
- `POST /incidents`              → create incident (accept tenantId, guildId, severity)
- `POST /licenses/activate`      → returns plan, flags, limits, refreshInSec
- `POST /exports` / `POST /imports`
- `POST /webhooks/stripe`        → trial/plan updates; metered usage

## Runtime checklist (Bot Runner)
- [ ] On config change → re-register slash commands for that guild only
- [ ] Backpressure: queue non-critical tasks; respect Discord rate limits
- [ ] Crash-safe: graceful shutdown, resume queues, rehydrate features

## Local Dev
```bash
# first time
npm i
# start api, runner, workers (choose your script names)
npm run dev:api
npm run dev:runner
npm run dev:workers
# docker
docker compose up -d
```

## Environment Variables (minimal)

```env
DISCORD_TOKEN=
APPLICATION_ID=
DATABASE_URL=
REDIS_URL=
TOWNESDEV_LICENSE=
LICENSE_SERVER_BASE=http://localhost:3000
STRIPE_SECRET=
STRIPE_WEBHOOK_SECRET=
```
