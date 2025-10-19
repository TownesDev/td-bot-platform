import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import pino from "pino";
import { CommandRegistry, CommandHandler, CommandContext } from "./registry.js";
import { CommandParser, CommandArgument } from "./parser.js";
import { licenseManager } from "../license.js";

// Execution result
export interface CommandExecutionResult {
  success: boolean;
  error?: string;
  duration: number;
  command: string;
  user: string;
  guild?: string | null;
}

// Command executor class
export class CommandExecutor {
  private registry: CommandRegistry;
  private parser: CommandParser;
  private logger: ReturnType<typeof pino>;

  constructor(
    registry: CommandRegistry,
    parser: CommandParser,
    logger: ReturnType<typeof pino>
  ) {
    this.registry = registry;
    this.parser = parser;
    this.logger = logger.child({ component: "command-executor" });
  }

  /**
   * Execute a command from interaction
   */
  async executeCommand(
    interaction: ChatInputCommandInteraction,
    client: any
  ): Promise<CommandExecutionResult> {
    const startTime = Date.now();
    const commandName = interaction.commandName;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      // Get command handler
      const handler = this.registry.get(commandName);
      if (!handler) {
        throw new Error(`Unknown command: ${commandName}`);
      }

      // Check if command is enabled
      if (!handler.metadata.enabled) {
        throw new Error(`Command '${commandName}' is currently disabled`);
      }

      // Check cooldown
      const cooldownRemaining = this.registry.isOnCooldown(commandName, userId);
      if (cooldownRemaining > 0) {
        const seconds = Math.ceil(cooldownRemaining / 1000);
        throw new Error(
          `Command is on cooldown. Try again in ${seconds} seconds.`
        );
      }

      // Create execution context
      const context = await this.createCommandContext(
        interaction,
        client,
        handler
      );

      // Check permissions
      if (!this.checkPermissions(context, handler)) {
        throw new Error("You don't have permission to use this command.");
      }

      // Check premium requirements
      if (handler.metadata.premiumOnly && !context.isPremium) {
        throw new Error("This command requires a premium subscription.");
      }

      // Parse arguments if handler defines them
      let parsedArgs = {};
      if (handler.metadata.arguments) {
        parsedArgs = this.parser.parseArguments(
          interaction,
          handler.metadata.arguments
        );
      }

      // Add parsed args to context
      (context as any).args = parsedArgs;

      // Execute command
      this.logger.info(
        {
          command: commandName,
          user: userId,
          guild: guildId,
          args: Object.keys(parsedArgs),
        },
        "Executing command"
      );

      await handler.execute(context);

      // Set cooldown if configured
      if (handler.metadata.cooldown && handler.metadata.cooldown > 0) {
        this.registry.setCooldown(
          commandName,
          userId,
          handler.metadata.cooldown * 1000
        );
      }

      const duration = Date.now() - startTime;

      this.logger.info(
        {
          command: commandName,
          user: userId,
          guild: guildId,
          duration,
        },
        "Command executed successfully"
      );

      return {
        success: true,
        duration,
        command: commandName,
        user: userId,
        guild: guildId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      this.logger.error(
        {
          error: errorMessage,
          command: commandName,
          user: userId,
          guild: guildId,
          duration,
        },
        "Command execution failed"
      );

      // Try to send error response
      try {
        const reply = {
          content: `❌ ${errorMessage}`,
          ephemeral: true,
        };

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (replyError) {
        this.logger.error({ replyError }, "Failed to send error reply");
      }

      return {
        success: false,
        error: errorMessage,
        duration,
        command: commandName,
        user: userId,
        guild: guildId,
      };
    }
  }

  /**
   * Handle autocomplete for a command
   */
  async handleAutocomplete(
    interaction: AutocompleteInteraction,
    client: any
  ): Promise<void> {
    try {
      const commandName = interaction.commandName;
      const handler = this.registry.get(commandName);

      if (!handler || !handler.metadata.arguments) {
        return;
      }

      // Check permissions (basic check for autocomplete)
      const context = await this.createCommandContext(
        interaction,
        client,
        handler
      );
      if (!this.checkPermissions(context, handler)) {
        return; // Don't provide autocomplete if no permission
      }

      // Handle autocomplete
      await this.parser.handleAutocomplete(
        interaction,
        handler.metadata.arguments,
        handler.autocompleteOptions
      );
    } catch (error) {
      this.logger.error(
        {
          error,
          command: interaction.commandName,
        },
        "Autocomplete handling failed"
      );
    }
  }

  /**
   * Create command execution context
   */
  private async createCommandContext(
    interaction: ChatInputCommandInteraction | AutocompleteInteraction,
    client: any,
    handler: CommandHandler
  ): Promise<CommandContext> {
    const guild = interaction.guild;
    const member = interaction.member as any; // GuildMember

    // Get owner IDs from environment or config
    const ownerIds = process.env.OWNER_IDS?.split(",") || [];
    const isOwner = ownerIds.includes(interaction.user.id);

    // Check premium status
    const isPremium = licenseManager.hasPremiumAccess(guild?.id || "");

    return {
      interaction: interaction as ChatInputCommandInteraction,
      client,
      logger: this.logger,
      guild: guild
        ? {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount,
          }
        : null,
      user: {
        id: interaction.user.id,
        username: interaction.user.username || "Unknown",
        discriminator: interaction.user.discriminator || "0000",
        isOwner,
      },
      member,
      hasPermission: (permission: string) => {
        if (!member) return false;
        return member.permissions?.has(permission) || false;
      },
      hasRole: (roleId: string) => {
        if (!member) return false;
        return member.roles?.cache?.has(roleId) || false;
      },
      isPremium,
      hasFeatureAccess: (featureKey: string) => {
        if (!guild) return false;
        const validation = licenseManager.validateFeatureAccess(
          guild.id,
          featureKey
        );
        return validation.valid;
      },
    };
  }

  /**
   * Check if user has permission to execute command
   */
  private checkPermissions(
    context: CommandContext,
    handler: CommandHandler
  ): boolean {
    const { metadata } = handler;

    // Owner-only commands
    if (metadata.ownerOnly && !context.user.isOwner) {
      return false;
    }

    // Guild-only commands
    if (metadata.guildOnly && !context.guild) {
      return false;
    }

    // Required permissions
    if (metadata.permissions && metadata.permissions.length > 0) {
      for (const permission of metadata.permissions) {
        if (!context.hasPermission(permission)) {
          return false;
        }
      }
    }

    // Required roles
    if (metadata.roles && metadata.roles.length > 0) {
      for (const roleId of metadata.roles) {
        if (!context.hasRole(roleId)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      registry: this.registry.getStats(),
      // Add execution stats here in the future
    };
  }

  /**
   * Clear all cooldowns (admin function)
   */
  clearAllCooldowns(): void {
    this.registry.clearAllCooldowns();
  }
}
