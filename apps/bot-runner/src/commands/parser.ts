import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import { z } from "zod";
import pino from "pino";

// Parsed command arguments
export interface ParsedArguments {
  [key: string]: any;
}

// Command argument definition
export interface CommandArgument {
  name: string;
  description: string;
  type:
    | "string"
    | "integer"
    | "boolean"
    | "user"
    | "channel"
    | "role"
    | "mentionable"
    | "number"
    | "attachment";
  required?: boolean;
  choices?: Array<{ name: string; value: string | number }>;
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
  autocomplete?: boolean;
}

// Command parser class
export class CommandParser {
  private logger: ReturnType<typeof pino>;

  constructor(logger: ReturnType<typeof pino>) {
    this.logger = logger.child({ component: "command-parser" });
  }

  /**
   * Parse command arguments from interaction
   */
  parseArguments(
    interaction: ChatInputCommandInteraction,
    argumentDefinitions: CommandArgument[]
  ): ParsedArguments {
    const args: ParsedArguments = {};

    try {
      for (const argDef of argumentDefinitions) {
        const value = this.extractArgumentValue(interaction, argDef);

        // Validate required arguments
        if (argDef.required && (value === null || value === undefined)) {
          throw new Error(`Required argument '${argDef.name}' is missing`);
        }

        // Apply type validation
        if (value !== null && value !== undefined) {
          args[argDef.name] = this.validateArgumentType(value, argDef);
        } else if (argDef.required) {
          throw new Error(`Required argument '${argDef.name}' is missing`);
        }
      }

      this.logger.debug(
        { args: Object.keys(args) },
        "Arguments parsed successfully"
      );
      return args;
    } catch (error) {
      this.logger.error(
        { error, command: interaction.commandName },
        "Failed to parse arguments"
      );
      throw error;
    }
  }

  /**
   * Extract argument value from interaction
   */
  private extractArgumentValue(
    interaction: ChatInputCommandInteraction,
    argDef: CommandArgument
  ): any {
    try {
      switch (argDef.type) {
        case "string":
          return interaction.options.getString(argDef.name);
        case "integer":
          return interaction.options.getInteger(argDef.name);
        case "boolean":
          return interaction.options.getBoolean(argDef.name);
        case "number":
          return interaction.options.getNumber(argDef.name);
        case "user":
          return interaction.options.getUser(argDef.name);
        case "channel":
          return interaction.options.getChannel(argDef.name);
        case "role":
          return interaction.options.getRole(argDef.name);
        case "mentionable":
          return interaction.options.getMentionable(argDef.name);
        case "attachment":
          return interaction.options.getAttachment(argDef.name);
        default:
          throw new Error(`Unknown argument type: ${argDef.type}`);
      }
    } catch (error) {
      this.logger.error(
        { error, argName: argDef.name, argType: argDef.type },
        "Failed to extract argument value"
      );
      throw error;
    }
  }

  /**
   * Validate argument type and constraints
   */
  private validateArgumentType(value: any, argDef: CommandArgument): any {
    try {
      // Type-specific validation
      switch (argDef.type) {
        case "string":
          if (typeof value !== "string") {
            throw new Error(`Expected string, got ${typeof value}`);
          }
          if (argDef.minLength && value.length < argDef.minLength) {
            throw new Error(
              `String too short. Minimum length: ${argDef.minLength}`
            );
          }
          if (argDef.maxLength && value.length > argDef.maxLength) {
            throw new Error(
              `String too long. Maximum length: ${argDef.maxLength}`
            );
          }
          break;

        case "integer":
        case "number":
          if (typeof value !== "number" || isNaN(value)) {
            throw new Error(`Expected number, got ${typeof value}`);
          }
          if (argDef.minValue !== undefined && value < argDef.minValue) {
            throw new Error(`Value too small. Minimum: ${argDef.minValue}`);
          }
          if (argDef.maxValue !== undefined && value > argDef.maxValue) {
            throw new Error(`Value too large. Maximum: ${argDef.maxValue}`);
          }
          break;

        case "boolean":
          if (typeof value !== "boolean") {
            throw new Error(`Expected boolean, got ${typeof value}`);
          }
          break;

        case "user":
        case "channel":
        case "role":
        case "mentionable":
        case "attachment":
          // These are validated by Discord.js, just ensure they exist
          if (!value) {
            throw new Error(`Invalid ${argDef.type} provided`);
          }
          break;
      }

      // Validate choices if specified
      if (argDef.choices && argDef.choices.length > 0) {
        const validValues = argDef.choices.map((choice) => choice.value);
        if (!validValues.includes(value)) {
          throw new Error(
            `Invalid choice. Valid options: ${validValues.join(", ")}`
          );
        }
      }

      return value;
    } catch (error) {
      this.logger.error(
        { error, argName: argDef.name, value },
        "Argument validation failed"
      );
      throw error;
    }
  }

  /**
   * Handle autocomplete interactions
   */
  async handleAutocomplete(
    interaction: AutocompleteInteraction,
    argumentDefinitions: CommandArgument[],
    getAutocompleteOptions?: (
      argName: string,
      focusedValue: string
    ) => Promise<Array<{ name: string; value: string }>>
  ): Promise<void> {
    try {
      const focusedOption = interaction.options.getFocused(true);
      const argDef = argumentDefinitions.find(
        (arg) => arg.name === focusedOption.name
      );

      if (!argDef || !argDef.autocomplete) {
        return;
      }

      let options: Array<{ name: string; value: string }> = [];

      // Use custom autocomplete function if provided
      if (getAutocompleteOptions) {
        options = await getAutocompleteOptions(
          focusedOption.name,
          focusedOption.value
        );
      } else {
        // Use predefined choices
        options =
          argDef.choices?.map((choice) => ({
            name: choice.name,
            value: choice.value.toString(),
          })) || [];
      }

      // Filter options based on focused value
      const filtered = options.filter(
        (option) =>
          option.name
            .toLowerCase()
            .includes(focusedOption.value.toLowerCase()) ||
          option.value.toLowerCase().includes(focusedOption.value.toLowerCase())
      );

      await interaction.respond(filtered.slice(0, 25)); // Discord limit

      this.logger.debug(
        {
          command: interaction.commandName,
          arg: focusedOption.name,
          query: focusedOption.value,
          results: filtered.length,
        },
        "Autocomplete handled"
      );
    } catch (error) {
      this.logger.error(
        { error, command: interaction.commandName },
        "Autocomplete failed"
      );
      // Don't throw - autocomplete failures shouldn't crash
    }
  }

  /**
   * Create Zod schema from argument definitions
   */
  createValidationSchema(argumentDefinitions: CommandArgument[]): z.ZodSchema {
    const schema: Record<string, z.ZodTypeAny> = {};

    for (const argDef of argumentDefinitions) {
      let zodType: z.ZodTypeAny;

      switch (argDef.type) {
        case "string":
          zodType = z.string();
          if (argDef.minLength)
            zodType = (zodType as z.ZodString).min(argDef.minLength);
          if (argDef.maxLength)
            zodType = (zodType as z.ZodString).max(argDef.maxLength);
          break;

        case "integer":
          zodType = z.number().int();
          if (argDef.minValue !== undefined)
            zodType = (zodType as z.ZodNumber).min(argDef.minValue);
          if (argDef.maxValue !== undefined)
            zodType = (zodType as z.ZodNumber).max(argDef.maxValue);
          break;

        case "number":
          zodType = z.number();
          if (argDef.minValue !== undefined)
            zodType = (zodType as z.ZodNumber).min(argDef.minValue);
          if (argDef.maxValue !== undefined)
            zodType = (zodType as z.ZodNumber).max(argDef.maxValue);
          break;

        case "boolean":
          zodType = z.boolean();
          break;

        case "user":
        case "channel":
        case "role":
        case "mentionable":
        case "attachment":
          zodType = z.any(); // These are complex objects, validate at runtime
          break;

        default:
          zodType = z.any();
      }

      if (!argDef.required) {
        zodType = zodType.optional();
      }

      schema[argDef.name] = zodType;
    }

    return z.object(schema);
  }

  /**
   * Format argument definitions for help text
   */
  formatArgumentsForHelp(argumentDefinitions: CommandArgument[]): string {
    if (argumentDefinitions.length === 0) {
      return "No arguments required";
    }

    return argumentDefinitions
      .map((arg) => {
        const required = arg.required ? "(required)" : "(optional)";
        const type = arg.type.toUpperCase();
        let description = `${arg.name} ${required} - ${arg.description}`;

        if (arg.choices && arg.choices.length > 0) {
          const choices = arg.choices.map((c) => c.name).join(", ");
          description += ` (Options: ${choices})`;
        }

        return description;
      })
      .join("\n");
  }
}
