import type {
  Feature,
  FeatureContext,
  FeatureConfig,
  SlashCommand,
} from "feature-sdk";
import { GuildMember, EmbedBuilder, PermissionFlagsBits } from "discord.js";

// Feature configuration
const config: FeatureConfig = {
  key: "moderation",
  name: "Auto Moderation",
  description: "Automated moderation tools and spam protection",
  version: "1.0.0",
  category: "moderation",
  isPremium: true, // Premium feature
  permissions: ["KickMembers", "BanMembers", "ManageMessages"],
  defaultConfig: {
    enabled: false,
    spamProtection: true,
    maxMentions: 5,
    maxCapsPercentage: 70,
    warningThreshold: 3,
    autoKick: false,
    autoBan: false,
    logChannelId: null,
  },
};

// Moderation feature implementation
export class ModerationFeature implements Feature {
  readonly config = config;

  async register(context: FeatureContext): Promise<void> {
    context.logger.info("Moderation feature registered");
  }

  async enable(context: FeatureContext): Promise<void> {
    context.logger.info("Moderation feature enabled");
  }

  async disable(context: FeatureContext): Promise<void> {
    context.logger.info("Moderation feature disabled");
  }

  async messageCreate(context: FeatureContext, message: any): Promise<void> {
    try {
      const config = context.config as {
        enabled: boolean;
        spamProtection: boolean;
        maxMentions: number;
        maxCapsPercentage: number;
        warningThreshold: number;
        autoKick: boolean;
        autoBan: boolean;
        logChannelId: string | null;
      };

      if (!config.enabled || !config.spamProtection) return;

      // Skip if user has manage messages permission
      if (message.member?.permissions?.has(PermissionFlagsBits.ManageMessages))
        return;

      let violations = 0;
      let reasons: string[] = [];

      // Check mentions spam
      const mentionCount =
        message.mentions.users.size + message.mentions.roles.size;
      if (mentionCount > config.maxMentions) {
        violations++;
        reasons.push(
          `Too many mentions (${mentionCount}/${config.maxMentions})`
        );
      }

      // Check caps spam
      if (message.content) {
        const capsCount = (message.content.match(/[A-Z]/g) || []).length;
        const totalChars = message.content.replace(/\s/g, "").length;
        const capsPercentage =
          totalChars > 0 ? (capsCount / totalChars) * 100 : 0;

        if (capsPercentage > config.maxCapsPercentage) {
          violations++;
          reasons.push(
            `Too many caps (${Math.round(capsPercentage)}% > ${
              config.maxCapsPercentage
            }%)`
          );
        }
      }

      // If violations detected, take action
      if (violations > 0) {
        await this.handleViolation(context, message, reasons);

        // Log to configured channel
        if (config.logChannelId) {
          await this.logModerationAction(context, message, reasons);
        }
      }
    } catch (error) {
      context.logger.error(
        { error, messageId: message.id },
        "Moderation check failed"
      );
    }
  }

  private async handleViolation(
    context: FeatureContext,
    message: any,
    reasons: string[]
  ): Promise<void> {
    const config = context.config as typeof this.config.defaultConfig;

    try {
      // Delete the message
      await message.delete();

      // Send warning
      const warningEmbed = new EmbedBuilder()
        .setTitle("⚠️ Message Removed")
        .setDescription("Your message was removed for violating server rules.")
        .addFields({
          name: "Reasons",
          value: reasons.join("\n"),
        })
        .setColor(0xffa500)
        .setTimestamp();

      await message.channel.send({
        content: message.author.toString(),
        embeds: [warningEmbed],
      });

      // TODO: Track user violations and take progressive action
      // For now, just log the violation

      context.logger.info(
        {
          userId: message.author.id,
          channelId: message.channel.id,
          reasons,
          guildId: context.guild.id,
        },
        "Moderation violation handled"
      );
    } catch (error) {
      context.logger.error({ error }, "Failed to handle moderation violation");
    }
  }

  private async logModerationAction(
    context: FeatureContext,
    message: any,
    reasons: string[]
  ): Promise<void> {
    try {
      const config = context.config as {
        enabled: boolean;
        spamProtection: boolean;
        maxMentions: number;
        maxCapsPercentage: number;
        warningThreshold: number;
        autoKick: boolean;
        autoBan: boolean;
        logChannelId: string | null;
      };

      if (!config.logChannelId) return;

      const logChannel = context.guild.channels.cache.get(config.logChannelId);

      if (!logChannel || !logChannel.isTextBased()) return;

      const logEmbed = new EmbedBuilder()
        .setTitle("🛡️ Auto Moderation")
        .addFields(
          {
            name: "User",
            value: `${message.author.tag} (${message.author.id})`,
            inline: true,
          },
          {
            name: "Channel",
            value: message.channel.toString(),
            inline: true,
          },
          {
            name: "Reasons",
            value: reasons.join("\n"),
          },
          {
            name: "Message Content",
            value: message.content || "*No text content*",
          }
        )
        .setColor(0xff0000)
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      context.logger.error({ error }, "Failed to log moderation action");
    }
  }

  // Slash commands for manual moderation
  commands: SlashCommand[] = [
    {
      name: "warn",
      description: "Warn a user for rule violations",
      permissions: ["KickMembers"],
      execute: async (context, interaction) => {
        // TODO: Implement warn command
        await interaction.reply({
          content: "Warn command coming soon!",
          ephemeral: true,
        });
      },
    },
    {
      name: "kick",
      description: "Kick a user from the server",
      permissions: ["KickMembers"],
      execute: async (context, interaction) => {
        // TODO: Implement kick command
        await interaction.reply({
          content: "Kick command coming soon!",
          ephemeral: true,
        });
      },
    },
  ];
}

// Export default instance
export default new ModerationFeature();
