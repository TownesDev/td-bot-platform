import { ShardingManager } from "discord.js";
import { pino } from "pino";
import { z } from "zod";

// Environment schema
const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "Discord token is required"),
  APPLICATION_ID: z.string().min(1, "Application ID is required"),
  DATABASE_URL: z.string().min(1, "Database URL is required"),
  REDIS_URL: z.string().min(1, "Redis URL is required"),
  LICENSE_SERVER_BASE: z.string().url().default("http://localhost:3000"),
  TOWNESDEV_LICENSE: z.string().default("trial_placeholder"),
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.string().default("info"),
  SHARD_COUNT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
});

// Logger setup
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

// Validate environment
let env: z.infer<typeof EnvSchema>;
try {
  env = EnvSchema.parse(process.env);
  logger.info("Environment validation successful");
} catch (error) {
  logger.error({ error }, "Environment validation failed");
  process.exit(1);
}

// License activation
async function activateLicense() {
  try {
    logger.info("Activating license...");

    const response = await fetch(
      `${env.LICENSE_SERVER_BASE}/licenses/activate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          licenseKey: env.TOWNESDEV_LICENSE,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `License activation failed: ${error.error?.message || "Unknown error"}`
      );
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        `License activation failed: ${result.error?.message || "Unknown error"}`
      );
    }

    logger.info(
      {
        plan: result.license.plan,
        features: result.license.features,
        limits: result.license.limits,
      },
      "License activated successfully"
    );

    return result.license;
  } catch (error) {
    logger.error({ error }, "Failed to activate license");
    throw error;
  }
}

// Create sharding manager
function createShardManager() {
  logger.info("Creating shard manager...");

  const manager = new ShardingManager("./dist/bot.js", {
    token: env.DISCORD_TOKEN,
    totalShards: 1, // Start with 1 shard for testing
    shardList: [0],
    mode: "process",
    respawn: true,
    shardArgs: [],
    execArgv: [],
  });

  // Shard event handlers
  manager.on("shardCreate", (shard) => {
    logger.info({ shardId: shard.id }, "Shard created");

    shard.on("ready", () => {
      logger.info({ shardId: shard.id }, "Shard ready");
    });

    shard.on("disconnect", () => {
      logger.warn({ shardId: shard.id }, "Shard disconnected");
    });

    shard.on("reconnecting", () => {
      logger.info({ shardId: shard.id }, "Shard reconnecting");
    });

    shard.on("death", () => {
      logger.error({ shardId: shard.id }, "Shard died");
    });

    shard.on("error", (error) => {
      logger.error({ shardId: shard.id, error }, "Shard error");
    });

    // Log child process events
    shard.process?.on("exit", (code, signal) => {
      logger.info({ shardId: shard.id, code, signal }, "Shard process exited");
    });

    shard.process?.on("error", (error) => {
      logger.error({ shardId: shard.id, error }, "Shard process error");
    });
  });

  return manager;
}

// Main startup function
async function start() {
  try {
    logger.info("Starting TownesDev Bot Platform Runner...");

    // Step 1: Activate license
    const license = await activateLicense();

    // Step 2: Create and spawn shards
    const manager = createShardManager();

    logger.info("Spawning shards...");
    await manager.spawn({
      amount: manager.totalShards,
      delay: 5000,
      timeout: 60000,
    });

    logger.info(
      {
        totalShards: manager.totalShards,
        plan: license.plan,
        features: license.features,
      },
      "Bot platform started successfully"
    );

    // Step 3: Set up license refresh interval
    setInterval(async () => {
      try {
        await activateLicense();
      } catch (error) {
        logger.error({ error }, "Failed to refresh license");
      }
    }, (license.refreshInSec || 3600) * 1000); // Default 1 hour
  } catch (error) {
    logger.error({ error }, "Failed to start bot platform");
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  // TODO: Add cleanup logic for shards
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  // TODO: Add cleanup logic for shards
  process.exit(0);
});

// Unhandled errors
process.on("unhandledRejection", (error) => {
  logger.error({ error }, "Unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught exception");
  process.exit(1);
});

// Start the platform
start();
