import {
  PrismaClient,
  type Tenant,
  type Guild,
  type Feature,
  type GuildFeature,
  type UsageCounter,
  type AuditLog,
} from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Export types for use across the platform
export type {
  Tenant,
  Guild,
  Feature,
  GuildFeature,
  UsageCounter,
  AuditLog,
} from "@prisma/client";

// Utility types for common queries
export type TenantWithGuilds = Tenant & {
  guilds: Guild[];
};

export type GuildWithFeatures = Guild & {
  guildFeatures: (GuildFeature & {
    feature: Feature;
  })[];
};

export type FeatureWithGuilds = Feature & {
  guildFeatures: (GuildFeature & {
    guild: Guild;
  })[];
};
