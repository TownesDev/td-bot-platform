import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  MessageFlags,
} from "discord.js";
import { pino, Logger } from "pino";
import { z } from "zod";
import { config } from "dotenv";
import { CommandRegistry } from "./commands/registry.js";
import { CommandParser } from "./commands/parser.js";
import { CommandExecutor } from "./commands/executor.js";
import {
  FeatureRegistry,
  Feature,
} from "../../../packages/feature-sdk/dist/index.js";
import { FeatureLoader } from "./features/loader.js";
import { helpCommand } from "./commands/help.js";

// Load environment variables in child processes
config({ path: "../../../.env" });

// Environment schema
const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  APPLICATION_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.string().default("info"),
});

// Logger setup with shard ID
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
}).child({
  shard: process.env.SHARD_ID || "unknown",
  component: "bot",
});

// Create typed loggers for different systems
const commandLogger: ReturnType<typeof pino> = pino({
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
}).child({
  shard: process.env.SHARD_ID || "unknown",
  component: "command-system",
});

const featureLogger: Logger = pino({
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
}).child({
  shard: process.env.SHARD_ID || "unknown",
  component: "feature-system",
});

// Validate environment
let env: z.infer<typeof EnvSchema>;
try {
  env = EnvSchema.parse(process.env);
} catch (error) {
  logger.error({ error }, "Environment validation failed");
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent, // Only if you need message content
  ],
});

// Initialize core systems
const commandRegistry = new CommandRegistry(commandLogger);
const commandParser = new CommandParser(commandLogger);
const commandExecutor = new CommandExecutor(
  commandRegistry,
  commandParser,
  commandLogger
);

const featureRegistry = new FeatureRegistry(featureLogger);
const featureLoader = new FeatureLoader(
  featureRegistry,
  client,
  featureLogger,
  {
    featuresPath: "./features", // Path to features directory
  }
);

// Basic ping command
commandRegistry.register({
  metadata: {
    name: "ping",
    description: "Replies with Pong!",
    category: "utility",
    cooldown: 0,
    guildOnly: false,
    ownerOnly: false,
    premiumOnly: false,
    enabled: true,
  },
  execute: async (context) => {
    const latency = context.client.ws.ping;
    await context.interaction.reply({
      content: `🏓 Pong! Latency: ${latency}ms`,
      flags: MessageFlags.Ephemeral,
    });
  },
});

// Info command
commandRegistry.register({
  metadata: {
    name: "info",
    description: "Shows bot information",
    category: "utility",
    cooldown: 0,
    guildOnly: false,
    ownerOnly: false,
    premiumOnly: false,
    enabled: true,
  },
  execute: async (context) => {
    const uptime = Math.floor(context.client.uptime! / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    await context.interaction.reply({
      embeds: [
        {
          title: "TownesDev Bot Platform",
          description: "Discord Bot Platform with feature marketplace",
          fields: [
            {
              name: "🏰 Guilds",
              value: context.client.guilds.cache.size.toString(),
              inline: true,
            },
            {
              name: "⏱️ Uptime",
              value: `${hours}h ${minutes}m ${seconds}s`,
              inline: true,
            },
            {
              name: "🔢 Shard",
              value: context.client.shard?.ids.join(", ") || "N/A",
              inline: true,
            },
            {
              name: "📊 Commands",
              value: commandRegistry.getStats().total.toString(),
              inline: true,
            },
            {
              name: "🎯 Features",
              value: featureRegistry.getAll().length.toString(),
              inline: true,
            },
          ],
          color: 0x0099ff,
          timestamp: new Date().toISOString(),
        },
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});

// Features command
commandRegistry.register({
  metadata: {
    name: "features",
    description: "Lists available features for this guild",
    category: "utility",
    cooldown: 0,
    guildOnly: false,
    ownerOnly: false,
    premiumOnly: false,
    enabled: true,
  },
  execute: async (context) => {
    const features = featureRegistry.getAll();
    const guildFeatures = context.guild
      ? featureLoader.getGuildFeatures(context.guild.id)
      : new Map();

    const embed = {
      title: "🎯 Available Features",
      description: "Features available for this guild:",
      fields: features.map((feature) => {
        const instance = guildFeatures.get(feature.config.key);
        const status = instance?.enabled ? "✅ Enabled" : "❌ Disabled";
        const premium = feature.config.isPremium ? "💎 Premium" : "🆓 Free";

        return {
          name: `${feature.config.name} ${premium}`,
          value: `${feature.config.description || "No description"}\n${status}`,
          inline: false,
        };
      }),
      color: 0x00ff00,
      footer: {
        text: "Use the web dashboard to configure features",
      },
    };

    await context.interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
});

// Help command
commandRegistry.register(helpCommand);

// Refresh commands command (for development)
commandRegistry.register({
  metadata: {
    name: "refresh",
    description: "Clear and refresh all slash commands (development only)",
    category: "utility",
    cooldown: 30,
    guildOnly: false,
    ownerOnly: true, // Only bot owners can use this
    premiumOnly: false,
    enabled: true,
  },
  execute: async (context) => {
    if (!context.user.isOwner) {
      await context.interaction.reply({
        content: "This command is only available to bot owners.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      // First clear existing commands, then register new ones
      await clearCommands();
      await registerCommands();
      await context.interaction.reply({
        content: "✅ Slash commands cleared and refreshed successfully!",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error({ error }, "Failed to refresh commands");
      await context.interaction.reply({
        content: "❌ Failed to refresh commands. Check logs for details.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
});

// Clear commands command (for development)
commandRegistry.register({
  metadata: {
    name: "clear",
    description: "Clear all slash commands (development only)",
    category: "utility",
    cooldown: 60,
    guildOnly: false,
    ownerOnly: true, // Only bot owners can use this
    premiumOnly: false,
    enabled: true,
  },
  execute: async (context) => {
    if (!context.user.isOwner) {
      await context.interaction.reply({
        content: "This command is only available to bot owners.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await clearCommands();
      await context.interaction.reply({
        content:
          "✅ All slash commands cleared successfully!\n⚠️  Use `/refresh` to restore commands when ready.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error({ error }, "Failed to clear commands");
      await context.interaction.reply({
        content: "❌ Failed to clear commands. Check logs for details.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
});

// Register slash commands
async function registerCommands() {
  try {
    logger.info("Registering slash commands...");

    const rest = new REST().setToken(env.DISCORD_TOKEN);
    const commandBuilders = commandRegistry.getSlashCommandBuilders();

    // For development/testing, register commands for specific guilds
    // In production, you might want to register globally
    const testGuilds = process.env.TEST_GUILDS?.split(",") || [];

    if (testGuilds.length > 0) {
      // Register for test guilds (updates immediately)
      for (const guildId of testGuilds) {
        try {
          await rest.put(
            Routes.applicationGuildCommands(env.APPLICATION_ID, guildId),
            { body: commandBuilders.map((cmd) => cmd.toJSON()) }
          );
          logger.info(
            { guildId, commandCount: commandBuilders.length },
            "Registered guild commands"
          );
        } catch (error) {
          logger.error({ error, guildId }, "Failed to register guild commands");
        }
      }
    } else {
      // Register global commands (can take up to 1 hour to update)
      await rest.put(Routes.applicationCommands(env.APPLICATION_ID), {
        body: commandBuilders.map((cmd) => cmd.toJSON()),
      });
      logger.info(
        `Successfully registered ${commandBuilders.length} global slash commands`
      );
    }
  } catch (error) {
    logger.error({ error }, "Failed to register slash commands");
  }
}

// Clear slash commands (for development)
async function clearCommands() {
  try {
    logger.info("Clearing slash commands...");

    const rest = new REST().setToken(env.DISCORD_TOKEN);
    const testGuilds = process.env.TEST_GUILDS?.split(",") || [];

    if (testGuilds.length > 0) {
      // Clear commands for test guilds
      for (const guildId of testGuilds) {
        try {
          await rest.put(
            Routes.applicationGuildCommands(env.APPLICATION_ID, guildId),
            { body: [] }
          );
          logger.info({ guildId }, "Cleared guild commands");
        } catch (error) {
          logger.error({ error, guildId }, "Failed to clear guild commands");
        }
      }
    } else {
      // Clear global commands
      await rest.put(Routes.applicationCommands(env.APPLICATION_ID), {
        body: [],
      });
      logger.info("Cleared global slash commands");
    }
  } catch (error) {
    logger.error({ error }, "Failed to clear slash commands");
  }
}

// Event handlers
client.once(Events.ClientReady, async (readyClient) => {
  logger.info(
    {
      username: readyClient.user.username,
      id: readyClient.user.id,
      guilds: readyClient.guilds.cache.size,
      shard: readyClient.shard?.ids,
    },
    "Bot is ready!"
  );

  // Load features
  await featureLoader.loadFeatures();

  // Initialize features for existing guilds
  for (const guild of readyClient.guilds.cache.values()) {
    await featureLoader.initializeGuildFeatures(guild);
  }

  // Register commands when ready
  await registerCommands();
});

client.on(Events.GuildCreate, async (guild) => {
  logger.info(
    {
      guildId: guild.id,
      guildName: guild.name,
      memberCount: guild.memberCount,
    },
    "Joined new guild"
  );

  // Initialize features for the new guild
  await featureLoader.initializeGuildFeatures(guild);

  // TODO: Register guild in database
});

client.on(Events.GuildDelete, async (guild) => {
  logger.info(
    {
      guildId: guild.id,
      guildName: guild.name || "Unknown",
    },
    "Left guild"
  );

  // Cleanup features for the guild
  await featureLoader.cleanupGuild(guild.id);

  // TODO: Mark guild as inactive in database
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await commandExecutor.executeCommand(interaction, client);
  } else if (interaction.isAutocomplete()) {
    await commandExecutor.handleAutocomplete(interaction, client);
  }
});

// Forward events to features
client.on(Events.MessageCreate, async (message) => {
  if (message.guild) {
    await featureLoader.handleEvent(message.guild.id, "messageCreate", message);
  }
});

client.on(Events.MessageDelete, async (message) => {
  if (message.guild) {
    await featureLoader.handleEvent(message.guild.id, "messageDelete", message);
  }
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (newMessage.guild) {
    await featureLoader.handleEvent(
      newMessage.guild.id,
      "messageUpdate",
      oldMessage,
      newMessage
    );
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  await featureLoader.handleEvent(member.guild.id, "memberAdd", member);
});

client.on(Events.GuildMemberRemove, async (member) => {
  await featureLoader.handleEvent(member.guild.id, "memberRemove", member);
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  await featureLoader.handleEvent(
    newMember.guild.id,
    "memberUpdate",
    oldMember,
    newMember
  );
});

// Error handling
client.on(Events.Error, (error) => {
  logger.error({ error }, "Discord client error");
});

client.on(Events.Warn, (warning) => {
  logger.warn({ warning }, "Discord client warning");
});

// Shard events
client.on(Events.ShardError, (error, shardId) => {
  logger.error({ error, shardId }, "Shard error");
});

client.on(Events.ShardDisconnect, (event, shardId) => {
  logger.warn({ event, shardId }, "Shard disconnected");
});

client.on(Events.ShardReconnecting, (shardId) => {
  logger.info({ shardId }, "Shard reconnecting");
});

client.on(Events.ShardResume, (shardId) => {
  logger.info({ shardId }, "Shard resumed");
});

// Rate limit handling
client.rest.on("rateLimited", (rateLimitData) => {
  logger.warn({ rateLimitData }, "Rate limited");
});

// Start the bot
async function start() {
  try {
    logger.info("Starting bot shard...");
    await client.login(env.DISCORD_TOKEN);
    logger.info("Bot login completed");
  } catch (error) {
    logger.error({ error }, "Failed to start bot");
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down bot...");

  // Cleanup all features
  for (const guildId of featureLoader.getStats().guilds.map((g) => g.guildId)) {
    await featureLoader.cleanupGuild(guildId);
  }

  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down bot...");

  // Cleanup all features
  for (const guildId of featureLoader.getStats().guilds.map((g) => g.guildId)) {
    await featureLoader.cleanupGuild(guildId);
  }

  client.destroy();
  process.exit(0);
});

// Start if this file is run directly
if (
  import.meta.url.endsWith(process.argv[1]) ||
  import.meta.url.includes("bot.js")
) {
  start();
}
