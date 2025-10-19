import type {
  Client,
  Guild,
  GuildMember,
  Message,
  ChatInputCommandInteraction,
} from "discord.js";
import type { Logger } from "pino";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════════════
// Feature Configuration Schema
// ═══════════════════════════════════════════════════════════════════════════════════

export const FeatureConfigSchema = z.object({
  key: z.string().min(1, "Feature key is required"),
  name: z.string().min(1, "Feature name is required"),
  description: z.string().optional(),
  version: z.string().default("1.0.0"),
  category: z
    .enum(["general", "moderation", "engagement", "ai"])
    .default("general"),
  isPremium: z.boolean().default(false),
  permissions: z.array(z.string()).default([]), // Required Discord permissions
  configSchema: z.record(z.string(), z.unknown()).optional(), // JSON schema for feature config
  defaultConfig: z.record(z.string(), z.unknown()).default({}),
});

export type FeatureConfig = z.infer<typeof FeatureConfigSchema>;

// ═══════════════════════════════════════════════════════════════════════════════════
// Feature Context - Passed to all feature methods
// ═══════════════════════════════════════════════════════════════════════════════════

export interface FeatureContext {
  client: Client;
  guild: Guild;
  logger: Logger;
  config: Record<string, unknown>;

  // Helper methods
  updateConfig: (newConfig: Record<string, unknown>) => Promise<void>;
  incrementUsage: (type: string, count?: number) => Promise<void>;
  auditLog: (
    action: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════════
// Event Types that features can handle
// ═══════════════════════════════════════════════════════════════════════════════════

export interface FeatureEvents {
  // Guild lifecycle
  guildCreate?: (context: FeatureContext) => Promise<void>;
  guildDelete?: (context: FeatureContext) => Promise<void>;

  // Member events
  memberAdd?: (context: FeatureContext, member: GuildMember) => Promise<void>;
  memberRemove?: (
    context: FeatureContext,
    member: GuildMember
  ) => Promise<void>;
  memberUpdate?: (
    context: FeatureContext,
    oldMember: GuildMember,
    newMember: GuildMember
  ) => Promise<void>;

  // Message events
  messageCreate?: (context: FeatureContext, message: Message) => Promise<void>;
  messageDelete?: (context: FeatureContext, message: Message) => Promise<void>;
  messageUpdate?: (
    context: FeatureContext,
    oldMessage: Message,
    newMessage: Message
  ) => Promise<void>;

  // Moderation events
  memberBan?: (context: FeatureContext, member: GuildMember) => Promise<void>;
  memberUnban?: (context: FeatureContext, userId: string) => Promise<void>;

  // Custom events (for inter-feature communication)
  customEvent?: (
    context: FeatureContext,
    eventName: string,
    data: unknown
  ) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════════
// Slash Command Definition
// ═══════════════════════════════════════════════════════════════════════════════════

export interface SlashCommand {
  name: string;
  description: string;
  options?: any[]; // Discord.js command options
  permissions?: string[]; // Required permissions
  execute: (
    context: FeatureContext,
    interaction: ChatInputCommandInteraction
  ) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════════
// Feature Interface - All features must implement this
// ═══════════════════════════════════════════════════════════════════════════════════

export interface Feature extends FeatureEvents {
  // Feature metadata
  readonly config: FeatureConfig;

  // Lifecycle methods
  register(context: FeatureContext): Promise<void>;
  enable(context: FeatureContext): Promise<void>;
  disable(context: FeatureContext): Promise<void>;
  migrate?(
    context: FeatureContext,
    fromVersion: string,
    toVersion: string
  ): Promise<void>;

  // Optional slash commands
  commands?: SlashCommand[];

  // Health check
  healthCheck?(
    context: FeatureContext
  ): Promise<{ status: "ok" | "warning" | "error"; message?: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════════
// Feature Registry - Manages all features
// ═══════════════════════════════════════════════════════════════════════════════════

export class FeatureRegistry {
  private features = new Map<string, Feature>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "feature-registry" });
  }

  /**
   * Register a feature in the registry
   */
  register(feature: Feature): void {
    const key = feature.config.key;

    if (this.features.has(key)) {
      throw new Error(`Feature with key '${key}' is already registered`);
    }

    // Validate feature config
    const validConfig = FeatureConfigSchema.parse(feature.config);

    this.features.set(key, {
      ...feature,
      config: validConfig,
    });

    this.logger.info(
      {
        featureKey: key,
        featureName: validConfig.name,
        version: validConfig.version,
      },
      "Feature registered"
    );
  }

  /**
   * Get a feature by key
   */
  get(key: string): Feature | undefined {
    return this.features.get(key);
  }

  /**
   * Get all registered features
   */
  getAll(): Feature[] {
    return Array.from(this.features.values());
  }

  /**
   * Get features by category
   */
  getByCategory(category: string): Feature[] {
    return this.getAll().filter(
      (feature) => feature.config.category === category
    );
  }

  /**
   * Check if a feature is registered
   */
  has(key: string): boolean {
    return this.features.has(key);
  }

  /**
   * Get feature list for API responses
   */
  toJSON(): Array<{
    key: string;
    name: string;
    description?: string;
    category: string;
    version: string;
    isPremium: boolean;
  }> {
    return this.getAll().map((feature) => ({
      key: feature.config.key,
      name: feature.config.name,
      description: feature.config.description,
      category: feature.config.category,
      version: feature.config.version,
      isPremium: feature.config.isPremium,
    }));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════
// Base Feature Class - Provides common functionality
// ═══════════════════════════════════════════════════════════════════════════════════

export abstract class BaseFeature implements Feature {
  abstract readonly config: FeatureConfig;

  /**
   * Default register implementation - override if needed
   */
  async register(context: FeatureContext): Promise<void> {
    context.logger.info(
      {
        feature: this.config.key,
      },
      "Feature registered"
    );
  }

  /**
   * Default enable implementation - override if needed
   */
  async enable(context: FeatureContext): Promise<void> {
    context.logger.info(
      {
        feature: this.config.key,
      },
      "Feature enabled"
    );
  }

  /**
   * Default disable implementation - override if needed
   */
  async disable(context: FeatureContext): Promise<void> {
    context.logger.info(
      {
        feature: this.config.key,
      },
      "Feature disabled"
    );
  }

  /**
   * Default health check - override if needed
   */
  async healthCheck(
    context: FeatureContext
  ): Promise<{ status: "ok" | "warning" | "error"; message?: string }> {
    return { status: "ok" };
  }

  /**
   * Helper to validate config against schema
   */
  protected validateConfig(config: unknown, schema: z.ZodSchema): unknown {
    return schema.parse(config);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════
// Built-in Feature Types - For commonly used patterns
// ═══════════════════════════════════════════════════════════════════════════════════

export interface WelcomeFeatureConfig {
  enabled: boolean;
  channelId?: string;
  message: string;
  embedColor?: string;
  mentionUser?: boolean;
}

export interface XPFeatureConfig {
  enabled: boolean;
  xpPerMessage: number;
  cooldownSeconds: number;
  levelUpChannel?: string;
  excludedChannels: string[];
  levelRoles: Array<{ level: number; roleId: string }>;
}

export interface ModerationFeatureConfig {
  enabled: boolean;
  autoMod: {
    filterSpam: boolean;
    filterLinks: boolean;
    filterProfanity: boolean;
    maxMentions: number;
  };
  logChannel?: string;
  muteRole?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════════

/**
 * Create a feature context
 */
export function createFeatureContext(
  client: Client,
  guild: Guild,
  logger: Logger,
  config: Record<string, unknown>,
  updateConfig: (newConfig: Record<string, unknown>) => Promise<void>,
  incrementUsage: (type: string, count?: number) => Promise<void>,
  auditLog: (
    action: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>
): FeatureContext {
  return {
    client,
    guild,
    logger: logger.child({
      guildId: guild.id,
      guildName: guild.name,
    }),
    config,
    updateConfig,
    incrementUsage,
    auditLog,
  };
}

/**
 * Validate feature permissions
 */
export function validateFeaturePermissions(
  guild: Guild,
  feature: Feature
): { valid: boolean; missing: string[] } {
  const botMember = guild.members.me;
  if (!botMember) {
    return { valid: false, missing: ["Bot not in guild"] };
  }

  const requiredPermissions = feature.config.permissions || [];
  const missing: string[] = [];

  for (const permission of requiredPermissions) {
    if (!botMember.permissions.has(permission as any)) {
      missing.push(permission);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
