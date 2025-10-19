import {
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  GuildMember,
  User,
  Role,
  Channel,
  Attachment,
} from "discord.js";
import { z } from "zod";
import pino from "pino";

// Command metadata schema
export const CommandMetadataSchema = z.object({
  name: z.string().min(1).max(32),
  description: z.string().min(1).max(100),
  category: z.string().optional(),
  permissions: z.array(z.string()).optional(), // Discord permission strings
  roles: z.array(z.string()).optional(), // Required role IDs
  cooldown: z.number().min(0).default(0), // Cooldown in seconds
  guildOnly: z.boolean().default(false),
  ownerOnly: z.boolean().default(false),
  premiumOnly: z.boolean().default(false),
  enabled: z.boolean().default(true),
  aliases: z.array(z.string()).optional(),
  arguments: z.array(z.any()).optional(), // Command argument definitions
});

export type CommandMetadata = z.infer<typeof CommandMetadataSchema>;

// Command execution context
export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  client: any; // Discord client
  logger: ReturnType<typeof pino>;
  guild: {
    id: string;
    name: string;
    memberCount: number;
  } | null;
  user: {
    id: string;
    username: string;
    discriminator: string;
    isOwner: boolean;
  };
  member: GuildMember | null;
  hasPermission: (permission: string) => boolean;
  hasRole: (roleId: string) => boolean;
  isPremium: boolean;
  hasFeatureAccess: (featureKey: string) => boolean;
}

// Command handler interface
export interface CommandHandler {
  metadata: CommandMetadata;
  execute: (context: CommandContext) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  builder?: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  autocompleteOptions?: (
    argName: string,
    focusedValue: string
  ) => Promise<Array<{ name: string; value: string }>>;
}

// Command registry class
export class CommandRegistry {
  private commands = new Map<string, CommandHandler>();
  private aliases = new Map<string, string>(); // alias -> command name
  private cooldowns = new Map<string, Map<string, number>>(); // command -> user -> timestamp
  private logger: ReturnType<typeof pino>;

  constructor(logger: ReturnType<typeof pino>) {
    this.logger = logger.child({ component: "command-registry" });
  }

  /**
   * Register a command
   */
  register(command: CommandHandler): boolean {
    try {
      const { name } = command.metadata;

      // Validate command
      CommandMetadataSchema.parse(command.metadata);

      // Check for conflicts
      if (this.commands.has(name)) {
        this.logger.warn(
          { command: name },
          "Command already registered, overwriting"
        );
      }

      // Create slash command builder if not provided
      if (!command.builder) {
        const builder = new SlashCommandBuilder()
          .setName(command.metadata.name)
          .setDescription(command.metadata.description);

        // Add arguments if defined
        if (command.metadata.arguments) {
          for (const arg of command.metadata.arguments) {
            // This is a simplified implementation - you might want to expand this
            // based on your argument types
            builder.addStringOption((option: any) =>
              option
                .setName(arg.name)
                .setDescription(arg.description)
                .setRequired(arg.required || false)
            );
          }
        }

        command.builder = builder;
      }

      // Register command
      this.commands.set(name, command);
      this.logger.info({ command: name }, "Command registered");

      // Register aliases
      if (command.metadata.aliases) {
        for (const alias of command.metadata.aliases) {
          if (this.aliases.has(alias)) {
            this.logger.warn(
              { alias, existingCommand: this.aliases.get(alias) },
              "Alias conflict, skipping"
            );
            continue;
          }
          this.aliases.set(alias, name);
          this.logger.debug({ alias, command: name }, "Alias registered");
        }
      }

      return true;
    } catch (error) {
      this.logger.error(
        { error, command: command.metadata.name },
        "Failed to register command"
      );
      return false;
    }
  }

  /**
   * De-register a command (as requested by user)
   */
  deregister(name: string): boolean {
    try {
      const command = this.commands.get(name);
      if (!command) {
        this.logger.warn(
          { command: name },
          "Command not found for deregistration"
        );
        return false;
      }

      // Remove command
      this.commands.delete(name);

      // Remove aliases
      if (command.metadata.aliases) {
        for (const alias of command.metadata.aliases) {
          this.aliases.delete(alias);
        }
      }

      // Clear cooldowns
      this.cooldowns.delete(name);

      this.logger.info({ command: name }, "Command deregistered");
      return true;
    } catch (error) {
      this.logger.error(
        { error, command: name },
        "Failed to deregister command"
      );
      return false;
    }
  }

  /**
   * Get a command by name or alias
   */
  get(name: string): CommandHandler | undefined {
    // Check direct name first
    if (this.commands.has(name)) {
      return this.commands.get(name);
    }

    // Check aliases
    const realName = this.aliases.get(name);
    if (realName) {
      return this.commands.get(realName);
    }

    return undefined;
  }

  /**
   * Get all registered commands
   */
  getAll(): Map<string, CommandHandler> {
    return new Map(this.commands);
  }

  /**
   * Get commands by category
   */
  getByCategory(category: string): CommandHandler[] {
    const commands: CommandHandler[] = [];
    for (const [name, handler] of this.commands) {
      if (handler.metadata.category === category && handler.metadata.enabled) {
        commands.push(handler);
      }
    }
    return commands;
  }

  /**
   * Check if user is on cooldown for a command
   */
  isOnCooldown(commandName: string, userId: string): number {
    const commandCooldowns = this.cooldowns.get(commandName);
    if (!commandCooldowns) return 0;

    const userCooldown = commandCooldowns.get(userId);
    if (!userCooldown) return 0;

    const remaining = userCooldown - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Set cooldown for a user on a command
   */
  setCooldown(commandName: string, userId: string, durationMs: number): void {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map());
    }

    const commandCooldowns = this.cooldowns.get(commandName)!;
    commandCooldowns.set(userId, Date.now() + durationMs);
  }

  /**
   * Clear cooldown for a user on a command
   */
  clearCooldown(commandName: string, userId: string): void {
    const commandCooldowns = this.cooldowns.get(commandName);
    if (commandCooldowns) {
      commandCooldowns.delete(userId);
    }
  }

  /**
   * Get slash command builders for Discord registration
   */
  getSlashCommandBuilders(): (
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
  )[] {
    const builders: (
      | SlashCommandBuilder
      | SlashCommandSubcommandsOnlyBuilder
    )[] = [];

    for (const [name, handler] of this.commands) {
      if (handler.builder && handler.metadata.enabled) {
        builders.push(handler.builder);
      }
    }

    return builders;
  }

  /**
   * Get command statistics
   */
  getStats() {
    const categories = new Map<string, number>();
    let totalCommands = 0;
    let enabledCommands = 0;

    for (const [name, handler] of this.commands) {
      totalCommands++;
      if (handler.metadata.enabled) {
        enabledCommands++;
      }

      const category = handler.metadata.category || "uncategorized";
      categories.set(category, (categories.get(category) || 0) + 1);
    }

    return {
      total: totalCommands,
      enabled: enabledCommands,
      disabled: totalCommands - enabledCommands,
      categories: Object.fromEntries(categories),
      aliases: this.aliases.size,
    };
  }

  /**
   * Enable/disable a command
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const command = this.commands.get(name);
    if (!command) return false;

    command.metadata.enabled = enabled;
    this.logger.info(
      { command: name, enabled },
      "Command enabled status changed"
    );
    return true;
  }

  /**
   * Clear all cooldowns (useful for maintenance)
   */
  clearAllCooldowns(): void {
    this.cooldowns.clear();
    this.logger.info("All command cooldowns cleared");
  }
}
