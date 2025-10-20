import { Feature, FeatureContext, FeatureConfig } from "feature-sdk";
import { GuildMember, EmbedBuilder } from "discord.js";

// Feature configuration
const config: FeatureConfig = {
  key: "welcome",
  name: "Welcome Messages",
  description: "Automatically send welcome messages to new members",
  version: "1.0.0",
  category: "engagement",
  isPremium: false,
  permissions: ["SendMessages", "EmbedLinks"],
  defaultConfig: {
    enabled: true,
    channelId: null,
    message: "Welcome {user} to {guild}! We're glad to have you here. 🎉",
    embedColor: 0x00ff00,
    useEmbed: true,
  },
};

// Welcome feature implementation
export class WelcomeFeature implements Feature {
  readonly config = config;

  async register(context: FeatureContext): Promise<void> {
    context.logger.info("Welcome feature registered");
  }

  async enable(context: FeatureContext): Promise<void> {
    context.logger.info("Welcome feature enabled");
  }

  async disable(context: FeatureContext): Promise<void> {
    context.logger.info("Welcome feature disabled");
  }

  async memberAdd(context: FeatureContext, member: GuildMember): Promise<void> {
    try {
      const config = context.config as typeof this.config.defaultConfig;

      if (!config.enabled) return;

      // Get welcome channel
      let channelId = config.channelId;
      if (!channelId) {
        // Try to find a general/welcome channel
        const generalChannel = context.guild.channels.cache.find(
          ch => ch.name.includes("general") || ch.name.includes("welcome")
        );
        if (generalChannel && generalChannel.isTextBased()) {
          channelId = generalChannel.id;
        } else {
          // Use system channel or first text channel
          channelId = context.guild.systemChannelId || context.guild.channels.cache
            .filter(ch => ch.isTextBased())
            .first()?.id;
        }
      }

      if (!channelId) {
        context.logger.warn("No suitable channel found for welcome messages");
        return;
      }

      const channel = context.guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) {
        context.logger.warn({ channelId }, "Welcome channel not found or not text-based");
        return;
      }

      // Format message
      const message = config.message
        .replace("{user}", member.toString())
        .replace("{username}", member.user.username)
        .replace("{guild}", context.guild.name)
        .replace("{memberCount}", context.guild.memberCount.toString());

      if (config.useEmbed) {
        const embed = new EmbedBuilder()
          .setTitle("👋 Welcome!")
          .setDescription(message)
          .setColor(config.embedColor)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(message);
      }

      context.logger.info({
        userId: member.id,
        channelId,
        guildId: context.guild.id
      }, "Welcome message sent");

    } catch (error) {
      context.logger.error({ error, userId: member.id }, "Failed to send welcome message");
    }
  }
}

// Export default instance
export default new WelcomeFeature();