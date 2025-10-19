# ADR-000: Architecture Decision Record - Foundation

**Date**: 2025-10-19  
**Status**: Accepted  
**Context**: Initial architecture decisions for TownesDev Bot Platform

## Decision

We will build a microservices-based Discord bot platform with the following architectural components:

### Core Architecture

- **Monorepo Structure**: Single repository with multiple packages and applications
- **TypeScript**: Strict typing throughout the entire platform
- **Database**: PostgreSQL with Prisma ORM as single source of truth
- **API**: Fastify-based REST API with Zod validation
- **Bot Runtime**: discord.js with shard management
- **Licensing**: Internal license service with activation/refresh endpoints

### Technology Stack

- **Language**: TypeScript (ES2022, ESNext modules)
- **Database**: PostgreSQL 15+ with Prisma ORM
- **API Framework**: Fastify 5+ with plugins for security, CORS, rate limiting
- **Bot Framework**: discord.js 14+ with sharding support
- **Validation**: Zod for runtime type checking
- **Logging**: Pino for structured logging
- **Queue**: BullMQ with Redis (planned for EPIC 2)
- **Container**: Docker with multi-stage builds
- **Package Manager**: npm with workspaces

### Deployment Model

- **Development**: Local with Docker Compose
- **Production**: Docker containers with health checks
- **Hosting Options**: Both hosted (TownesDev-managed) and self-hosted

## Rationale

### Monorepo Benefits

- Shared type definitions and utilities
- Coordinated deployments
- Single CI/CD pipeline
- Easier refactoring across boundaries

### Technology Choices

**Fastify over Express**

- Better TypeScript support
- Built-in validation and serialization
- Superior performance
- Rich plugin ecosystem

**Prisma over raw SQL**

- Type-safe database access
- Automatic migrations
- Great developer experience
- Easy introspection

**discord.js over other libraries**

- Most mature Discord library for Node.js
- Excellent TypeScript support
- Active community and maintenance
- Built-in sharding support

**Zod for validation**

- Runtime type checking
- Excellent TypeScript integration
- Composable schemas
- Clear error messages

### Licensing Architecture

- Self-contained license service within the platform
- Mock license data for development
- Easy integration with TownesDev web app later
- Support for multiple plan types and feature flags

## Consequences

### Positive

- Strong type safety throughout the stack
- Consistent developer experience
- Easy to test and maintain
- Scalable architecture
- Good observability foundation

### Negative

- Higher initial complexity than simple bot
- Requires TypeScript knowledge
- More moving parts to manage
- Docker dependency for local development

### Neutral

- Learning curve for team members
- Need to maintain multiple services
- Requires good documentation

## Implementation Notes

### EPIC 1 Scope

- Basic monorepo structure ✅
- Prisma schema with core models ✅
- API with license endpoints ✅
- Bot runner with shard management ✅
- Feature SDK foundation ✅
- Docker configuration ✅
- Basic documentation ✅

### Future Considerations

- EPIC 2: Add BullMQ workers, AI features, export/import
- EPIC 3: Admin interfaces, support tools, analytics
- Consider GraphQL for complex queries later
- Evaluate event-driven architecture for feature communication
- Plan for horizontal scaling with multiple bot instances

## Alternatives Considered

### Single Application

**Rejected**: Would not scale well and harder to manage different concerns

### Different Databases

- **MongoDB**: Rejected due to less mature TypeScript tooling
- **SQLite**: Rejected due to scaling limitations

### Different API Frameworks

- **Express**: Rejected due to less TypeScript support
- **Koa**: Rejected due to smaller ecosystem
- **NestJS**: Considered but too heavy for our needs

### Different Bot Libraries

- **Eris**: Rejected due to smaller community
- **discord-akairo**: Rejected due to being built on discord.js anyway

This ADR establishes the foundation architecture that supports our goal of building a production-ready, scalable Discord bot platform with proper licensing, feature management, and operational capabilities.
