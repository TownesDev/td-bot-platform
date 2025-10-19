import { Client, Guild } from "discord.js";
import { Logger } from "pino";
import fs from "fs/promises";
import path from "path";
import { FeatureRegistry, Feature, FeatureContext } from "feature-sdk";
import pino from "pino";
import { licenseManager } from "../license.js";

function createFeatureContext(
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
    logger: logger.child({ guildId: guild.id, guildName: guild.name }),
    config,
    updateConfig,
    incrementUsage,
    auditLog,
  };
}

function validateFeaturePermissions(
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

  return { valid: missing.length === 0, missing };
}

// Feature loader configuration
export interface FeatureLoaderConfig {
  featuresPath: string; // Path to features directory
  enabledFeatures?: string[]; // Whitelist of enabled features
  disabledFeatures?: string[]; // Blacklist of disabled features
}

// Feature instance with runtime data
export interface FeatureInstance {
  feature: Feature;
  context: FeatureContext;
  enabled: boolean;
  loadedAt: Date;
  config: Record<string, unknown>;
}

// Feature loader class
export class FeatureLoader {
  private registry: FeatureRegistry;
  private client: Client;
  private logger: Logger;
  private config: FeatureLoaderConfig;
  private instances = new Map<string, Map<string, FeatureInstance>>(); // guildId -> featureKey -> instance

  constructor(
    registry: FeatureRegistry,
    client: Client,
    logger: Logger,
    config: FeatureLoaderConfig
  ) {
    this.registry = registry;
    this.client = client;
    this.logger = logger as any;
    this.config = config;
  }

  /**
   * Load all features from the filesystem
   */
  async loadFeatures(): Promise<void> {
    try {
      this.logger.info(
        { path: this.config.featuresPath },
        "Loading features from filesystem"
      );

      // Check if features directory exists
      try {
        await fs.access(this.config.featuresPath);
      } catch (error) {
        this.logger.warn(
          { path: this.config.featuresPath },
          "Features directory not found, skipping"
        );
        return;
      }

      // Read feature directories
      const entries = await fs.readdir(this.config.featuresPath, {
        withFileTypes: true,
      });
      const featureDirs = entries.filter((entry) => entry.isDirectory());

      this.logger.info(
        { count: featureDirs.length },
        "Found feature directories"
      );

      // Load each feature
      for (const dir of featureDirs) {
        await this.loadFeature(dir.name);
      }

      this.logger.info("Feature loading completed");
    } catch (error) {
      this.logger.error({ error }, "Failed to load features");
      throw error;
    }
  }

  /**
   * Load a single feature by name
   */
  private async loadFeature(featureName: string): Promise<void> {
    try {
      const featurePath = path.join(this.config.featuresPath, featureName);
      const indexPath = path.join(featurePath, "index.js");

      // Check if feature should be loaded
      if (this.config.disabledFeatures?.includes(featureName)) {
        this.logger.debug(
          { feature: featureName },
          "Feature disabled by configuration"
        );
        return;
      }

      if (
        this.config.enabledFeatures &&
        !this.config.enabledFeatures.includes(featureName)
      ) {
        this.logger.debug(
          { feature: featureName },
          "Feature not in enabled list"
        );
        return;
      }

      // Check if index file exists
      try {
        await fs.access(indexPath);
      } catch (error) {
        this.logger.warn(
          { feature: featureName, path: indexPath },
          "Feature index file not found"
        );
        return;
      }

      // Dynamic import
      const module = await import(indexPath);

      if (!module.default) {
        this.logger.warn(
          { feature: featureName },
          "Feature module missing default export"
        );
        return;
      }

      const feature: Feature = module.default;

      // Validate feature
      if (!feature.config || !feature.config.key) {
        this.logger.warn(
          { feature: featureName },
          "Feature missing valid config"
        );
        return;
      }

      // Register feature
      this.registry.register(feature);

      this.logger.info(
        {
          feature: featureName,
          key: feature.config.key,
          version: feature.config.version,
        },
        "Feature loaded successfully"
      );
    } catch (error) {
      this.logger.error(
        { error, feature: featureName },
        "Failed to load feature"
      );
    }
  }

  /**
   * Initialize features for a guild
   */
  async initializeGuildFeatures(guild: Guild): Promise<void> {
    try {
      const guildInstances = new Map<string, FeatureInstance>();
      this.instances.set(guild.id, guildInstances);

      this.logger.info(
        { guildId: guild.id, guildName: guild.name },
        "Initializing guild features"
      );

      // Get all registered features
      const features = this.registry.getAll();

      for (const feature of features) {
        await this.initializeFeatureForGuild(feature, guild, guildInstances);
      }

      this.logger.info(
        {
          guildId: guild.id,
          featureCount: guildInstances.size,
        },
        "Guild features initialized"
      );
    } catch (error) {
      this.logger.error(
        { error, guildId: guild.id },
        "Failed to initialize guild features"
      );
    }
  }

  /**
   * Initialize a single feature for a guild
   */
  private async initializeFeatureForGuild(
    feature: Feature,
    guild: Guild,
    guildInstances: Map<string, FeatureInstance>
  ): Promise<void> {
    try {
      const featureKey = feature.config.key;

      // Check permissions
      const permissionCheck = validateFeaturePermissions(guild, feature);
      if (!permissionCheck.valid) {
        this.logger.warn(
          {
            feature: featureKey,
            guildId: guild.id,
            missingPermissions: permissionCheck.missing,
          },
          "Feature missing required permissions"
        );
        return;
      }

      // TODO: Load feature config from database
      const config = { ...feature.config.defaultConfig };

      // Create feature context
      const context = createFeatureContext(
        this.client,
        guild,
        this.logger,
        config,
        async (newConfig) => {
          // TODO: Save config to database
          Object.assign(config, newConfig);
        },
        async (type, count = 1) => {
          // TODO: Track feature usage in database
          this.logger.debug(
            { feature: featureKey, type, count },
            "Feature usage tracked"
          );
        },
        async (action, metadata) => {
          // TODO: Log to audit trail
          this.logger.info(
            { feature: featureKey, action, metadata },
            "Feature audit log"
          );
        }
      );

      // Register feature
      await feature.register(context);

      // Create instance
      const instance: FeatureInstance = {
        feature,
        context,
        enabled: false, // Will be enabled based on guild settings
        loadedAt: new Date(),
        config,
      };

      guildInstances.set(featureKey, instance);

      this.logger.debug(
        {
          feature: featureKey,
          guildId: guild.id,
        },
        "Feature initialized for guild"
      );
    } catch (error) {
      this.logger.error(
        {
          error,
          feature: feature.config.key,
          guildId: guild.id,
        },
        "Failed to initialize feature for guild"
      );
    }
  }

  /**
   * Enable a feature for a guild
   */
  async enableFeature(guildId: string, featureKey: string): Promise<boolean> {
    try {
      const guildInstances = this.instances.get(guildId);
      if (!guildInstances) {
        throw new Error(`Guild ${guildId} not found`);
      }

      const instance = guildInstances.get(featureKey);
      if (!instance) {
        throw new Error(`Feature ${featureKey} not found for guild ${guildId}`);
      }

      if (instance.enabled) {
        return true; // Already enabled
      }

      // Check license for premium features
      if (instance.feature.config.isPremium) {
        const licenseCheck = licenseManager.validateFeatureAccess(
          guildId,
          featureKey
        );
        if (!licenseCheck.valid) {
          throw new Error(
            `Premium feature requires valid license: ${licenseCheck.reason}`
          );
        }
      }

      await instance.feature.enable(instance.context);
      instance.enabled = true;

      this.logger.info(
        {
          feature: featureKey,
          guildId,
        },
        "Feature enabled for guild"
      );

      return true;
    } catch (error) {
      this.logger.error(
        {
          error,
          feature: featureKey,
          guildId,
        },
        "Failed to enable feature"
      );
      return false;
    }
  }

  /**
   * Disable a feature for a guild
   */
  async disableFeature(guildId: string, featureKey: string): Promise<boolean> {
    try {
      const guildInstances = this.instances.get(guildId);
      if (!guildInstances) {
        return false;
      }

      const instance = guildInstances.get(featureKey);
      if (!instance || !instance.enabled) {
        return true; // Already disabled or not found
      }

      await instance.feature.disable(instance.context);
      instance.enabled = false;

      this.logger.info(
        {
          feature: featureKey,
          guildId,
        },
        "Feature disabled for guild"
      );

      return true;
    } catch (error) {
      this.logger.error(
        {
          error,
          feature: featureKey,
          guildId,
        },
        "Failed to disable feature"
      );
      return false;
    }
  }

  /**
   * Get feature instance for a guild
   */
  getFeatureInstance(
    guildId: string,
    featureKey: string
  ): FeatureInstance | undefined {
    return this.instances.get(guildId)?.get(featureKey);
  }

  /**
   * Get all feature instances for a guild
   */
  getGuildFeatures(guildId: string): Map<string, FeatureInstance> {
    return this.instances.get(guildId) || new Map();
  }

  /**
   * Handle event for all enabled features in a guild
   */
  async handleEvent(
    guildId: string,
    eventName: string,
    ...args: any[]
  ): Promise<void> {
    const guildInstances = this.instances.get(guildId);
    if (!guildInstances) return;

    const promises: Promise<void>[] = [];

    for (const [featureKey, instance] of guildInstances) {
      if (!instance.enabled) continue;

      const eventHandler = (instance.feature as any)[eventName];
      if (typeof eventHandler === "function") {
        promises.push(
          (eventHandler as any)
            .call(instance.feature, instance.context, ...args)
            .catch((error: any) => {
              this.logger.error(
                {
                  error,
                  feature: featureKey,
                  guildId,
                  event: eventName,
                },
                "Feature event handler failed"
              );
            })
        );
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Get loader statistics
   */
  getStats() {
    const stats = {
      totalGuilds: this.instances.size,
      totalFeatures: 0,
      enabledFeatures: 0,
      guilds: [] as Array<{
        guildId: string;
        featureCount: number;
        enabledCount: number;
      }>,
    };

    for (const [guildId, guildInstances] of this.instances) {
      let enabledCount = 0;

      for (const instance of guildInstances.values()) {
        stats.totalFeatures++;
        if (instance.enabled) {
          stats.enabledFeatures++;
          enabledCount++;
        }
      }

      stats.guilds.push({
        guildId,
        featureCount: guildInstances.size,
        enabledCount,
      });
    }

    return stats;
  }

  /**
   * Cleanup resources for a guild (when bot leaves)
   */
  async cleanupGuild(guildId: string): Promise<void> {
    const guildInstances = this.instances.get(guildId);
    if (!guildInstances) return;

    // Disable all features
    const promises: Promise<void>[] = [];
    for (const [featureKey, instance] of guildInstances) {
      if (instance.enabled) {
        promises.push(
          instance.feature.disable(instance.context).catch((error: any) => {
            this.logger.error(
              {
                error,
                feature: featureKey,
                guildId,
              },
              "Failed to disable feature during cleanup"
            );
          })
        );
      }
    }

    await Promise.allSettled(promises);
    this.instances.delete(guildId);

    this.logger.info({ guildId }, "Guild features cleaned up");
  }
}
