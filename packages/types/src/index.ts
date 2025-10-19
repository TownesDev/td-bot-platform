import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════════════
// License System Types
// ═══════════════════════════════════════════════════════════════════════════════════

export const LicenseActivateRequestSchema = z.object({
  licenseKey: z.string().min(1, "License key is required"),
  guildId: z.string().optional(), // For guild-specific activation
});

export const LicenseActivateResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  license: z
    .object({
      plan: z.enum(["trial", "bronze", "silver", "gold", "enterprise"]),
      isActive: z.boolean(),
      expiresAt: z.string().datetime().optional(),
      features: z.array(z.string()), // Array of enabled feature keys
      limits: z.object({
        maxGuilds: z.number(),
        aiTokensDaily: z.number(),
        // Add more limits as needed
      }),
      refreshInSec: z.number(), // How often to refresh license
    })
    .optional(),
});

export const LicenseRefreshRequestSchema = z.object({
  licenseKey: z.string().min(1),
  tenantId: z.string().optional(),
});

export const LicenseRefreshResponseSchema = LicenseActivateResponseSchema;

// ═══════════════════════════════════════════════════════════════════════════════════
// Guild Management Types
// ═══════════════════════════════════════════════════════════════════════════════════

export const GuildConfigSchema = z.object({
  id: z.string(), // Discord guild ID
  name: z.string(),
  iconUrl: z.string().url().optional(),
  memberCount: z.number().default(0),
  prefix: z.string().default("!"),
  language: z.string().default("en"),
  timezone: z.string().default("UTC"),
  isActive: z.boolean().default(true),
});

export const GuildCreateRequestSchema = GuildConfigSchema.omit({
  iconUrl: true,
  memberCount: true,
}).extend({
  tenantId: z.string(),
});

export const GuildUpdateRequestSchema = GuildConfigSchema.partial().extend({
  id: z.string(), // Always required for updates
});

// ═══════════════════════════════════════════════════════════════════════════════════
// Feature System Types
// ═══════════════════════════════════════════════════════════════════════════════════

export const FeatureSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z
    .enum(["general", "moderation", "engagement", "ai"])
    .default("general"),
  version: z.string().default("1.0.0"),
  isBuiltIn: z.boolean().default(true),
  isPremium: z.boolean().default(false),
  configSchema: z.record(z.string(), z.unknown()).optional(), // JSON schema
  defaultConfig: z.record(z.string(), z.unknown()).optional(), // Default values
});

export const FeatureToggleRequestSchema = z.object({
  guildId: z.string(),
  featureKey: z.string(),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const FeatureToggleResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  feature: z
    .object({
      key: z.string(),
      enabled: z.boolean(),
      config: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════════
// Usage & Analytics Types
// ═══════════════════════════════════════════════════════════════════════════════════

export const UsageCounterSchema = z.object({
  type: z.string(), // e.g., "events_processed", "ai_tokens_used"
  date: z.string().datetime(),
  count: z.number().default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UsageReportRequestSchema = z.object({
  tenantId: z.string().optional(),
  guildId: z.string().optional(),
  type: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const UsageReportResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(UsageCounterSchema),
  summary: z.object({
    totalCount: z.number(),
    averageDaily: z.number(),
    peakDay: z.string().datetime().optional(),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════════
// Export/Import Types
// ═══════════════════════════════════════════════════════════════════════════════════

export const ExportRequestSchema = z.object({
  tenantId: z.string(),
  includeGuilds: z.boolean().default(true),
  includeFeatures: z.boolean().default(true),
  includeUsage: z.boolean().default(false),
  format: z.enum(["json", "csv"]).default("json"),
});

export const ExportResponseSchema = z.object({
  success: z.boolean(),
  exportId: z.string(),
  downloadUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});

export const ImportRequestSchema = z.object({
  tenantId: z.string(),
  data: z.record(z.string(), z.unknown()), // The exported data structure
  overwriteExisting: z.boolean().default(false),
});

export const ImportResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  imported: z.object({
    guilds: z.number(),
    features: z.number(),
    configurations: z.number(),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════════
// Discord API Types
// ═══════════════════════════════════════════════════════════════════════════════════

export const DiscordGuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  owner: z.boolean().optional(),
  permissions: z.string().optional(),
  member_count: z.number().optional(),
});

export const DiscordUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  discriminator: z.string(),
  avatar: z.string().nullable(),
  email: z.string().email().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════════
// API Response Wrappers
// ═══════════════════════════════════════════════════════════════════════════════════

export const ApiSuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
    requestId: z.string().optional(),
  });

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
  requestId: z.string().optional(),
});

export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.union([ApiSuccessResponseSchema(dataSchema), ApiErrorResponseSchema]);

// ═══════════════════════════════════════════════════════════════════════════════════
// Type Exports
// ═══════════════════════════════════════════════════════════════════════════════════

export type LicenseActivateRequest = z.infer<
  typeof LicenseActivateRequestSchema
>;
export type LicenseActivateResponse = z.infer<
  typeof LicenseActivateResponseSchema
>;
export type LicenseRefreshRequest = z.infer<typeof LicenseRefreshRequestSchema>;
export type LicenseRefreshResponse = z.infer<
  typeof LicenseRefreshResponseSchema
>;

export type GuildConfig = z.infer<typeof GuildConfigSchema>;
export type GuildCreateRequest = z.infer<typeof GuildCreateRequestSchema>;
export type GuildUpdateRequest = z.infer<typeof GuildUpdateRequestSchema>;

export type Feature = z.infer<typeof FeatureSchema>;
export type FeatureToggleRequest = z.infer<typeof FeatureToggleRequestSchema>;
export type FeatureToggleResponse = z.infer<typeof FeatureToggleResponseSchema>;

export type UsageCounter = z.infer<typeof UsageCounterSchema>;
export type UsageReportRequest = z.infer<typeof UsageReportRequestSchema>;
export type UsageReportResponse = z.infer<typeof UsageReportResponseSchema>;

export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type ExportResponse = z.infer<typeof ExportResponseSchema>;
export type ImportRequest = z.infer<typeof ImportRequestSchema>;
export type ImportResponse = z.infer<typeof ImportResponseSchema>;

export type DiscordGuild = z.infer<typeof DiscordGuildSchema>;
export type DiscordUser = z.infer<typeof DiscordUserSchema>;

export type ApiSuccessResponse<T> = z.infer<
  ReturnType<typeof ApiSuccessResponseSchema<z.ZodType<T>>>
>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ApiResponse<T> = z.infer<
  ReturnType<typeof ApiResponseSchema<z.ZodType<T>>>
>;
