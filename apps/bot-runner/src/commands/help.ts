import { CommandHandler } from "../commands/registry.js";
import { MessageFlags } from "discord.js";

export const helpCommand: CommandHandler = {
  metadata: {
    name: "help",
    description: "Shows available commands and their usage",
    category: "utility",
    cooldown: 5,
    guildOnly: false,
    ownerOnly: false,
    premiumOnly: false,
    enabled: true,
  },
  execute: async (context) => {
    const { interaction } = context;

    // For now, show a static help message
    // TODO: Dynamically get all registered commands
    const embed = {
      title: "🤖 Bot Commands",
      description:
        "Here are all available commands. Use `/command-name` to execute them.",
      fields: [
        {
          name: "📁 Utility",
          value:
            "`/help` - Shows this help message\n`/ping` - Replies with Pong!\n`/info` - Shows bot information\n`/features` - Lists available features",
          inline: false,
        },
        {
          name: "🔧 Development (Owner Only)",
          value:
            "`/refresh` - Clear and refresh all slash commands\n`/clear` - Clear all slash commands (panic button)",
          inline: false,
        },
        {
          name: "🎯 Features",
          value:
            "Features are loaded dynamically and provide additional functionality. Use `/features` to see what's available for this guild.",
          inline: false,
        },
      ],
      color: 0x00ff00,
      footer: {
        text: "TownesDev Bot Platform | More commands will be available as features are loaded",
      },
    };

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
