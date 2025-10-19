import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { pino } from "pino";
import { z } from "zod";
import { config } from "dotenv";

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

// Basic slash commands for testing
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("Shows bot information"),

  new SlashCommandBuilder()
    .setName("features")
    .setDescription("Lists available features for this guild"),
];

// Register slash commands
async function registerCommands() {
  try {
    logger.info("Registering slash commands...");

    const rest = new REST().setToken(env.DISCORD_TOKEN);

    // Register global commands
    await rest.put(Routes.applicationCommands(env.APPLICATION_ID), {
      body: commands.map((cmd) => cmd.toJSON()),
    });

    logger.info(
      `Successfully registered ${commands.length} global slash commands`
    );
  } catch (error) {
    logger.error({ error }, "Failed to register slash commands");
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

  // Register commands when ready
  await registerCommands();
});

client.on(Events.GuildCreate, (guild) => {
  logger.info(
    {
      guildId: guild.id,
      guildName: guild.name,
      memberCount: guild.memberCount,
    },
    "Joined new guild"
  );

  // TODO: Register guild in database
  // TODO: Set up default features for the guild
});

client.on(Events.GuildDelete, (guild) => {
  logger.info(
    {
      guildId: guild.id,
      guildName: guild.name || "Unknown",
    },
    "Left guild"
  );

  // TODO: Mark guild as inactive in database
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, user } = interaction;

  logger.info(
    {
      command: commandName,
      guildId,
      userId: user.id,
      username: user.username,
    },
    "Command executed"
  );

  try {
    switch (commandName) {
      case "ping":
        await interaction.reply({
          content: `Pong! 🏓\\nLatency: ${client.ws.ping}ms`,
          ephemeral: true,
        });
        break;

      case "info":
        const uptime = Math.floor(client.uptime! / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;

        await interaction.reply({
          embeds: [
            {
              title: "TownesDev Bot Platform",
              description: "Discord Bot Platform with feature marketplace",
              fields: [
                {
                  name: "Guilds",
                  value: client.guilds.cache.size.toString(),
                  inline: true,
                },
                {
                  name: "Uptime",
                  value: `${hours}h ${minutes}m ${seconds}s`,
                  inline: true,
                },
                {
                  name: "Shard",
                  value: client.shard?.ids.join(", ") || "N/A",
                  inline: true,
                },
              ],
              color: 0x0099ff,
              timestamp: new Date().toISOString(),
            },
          ],
          ephemeral: true,
        });
        break;

      case "features":
        // Mock features for now
        await interaction.reply({
          embeds: [
            {
              title: "Available Features",
              description: "Features available for this guild:",
              fields: [
                {
                  name: "🎉 Welcome Messages",
                  value: "Automated welcome messages for new members",
                  inline: false,
                },
                {
                  name: "⭐ XP System",
                  value: "Member activity tracking and leveling",
                  inline: false,
                },
                {
                  name: "🛡️ Auto Moderation",
                  value: "Automated moderation tools (Premium)",
                  inline: false,
                },
                {
                  name: "🤖 AI Concierge",
                  value: "AI-powered member assistance (Premium)",
                  inline: false,
                },
              ],
              color: 0x00ff00,
              footer: {
                text: "Use the web dashboard to configure features",
              },
            },
          ],
          ephemeral: true,
        });
        break;

      default:
        await interaction.reply({
          content: "Unknown command!",
          ephemeral: true,
        });
    }
  } catch (error) {
    logger.error({ error, command: commandName }, "Command execution failed");

    const errorReply = {
      content: "There was an error while executing this command!",
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errorReply);
    } else {
      await interaction.reply(errorReply);
    }
  }
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
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down bot...");
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
