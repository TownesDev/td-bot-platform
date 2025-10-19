import { z } from "zod";

// License schema
export const LicenseSchema = z.object({
  id: z.string(),
  guildId: z.string(),
  type: z.enum(["premium", "enterprise"]),
  features: z.array(z.string()), // Array of feature keys that are licensed
  issuedAt: z.date(),
  expiresAt: z.date().optional(),
  revokedAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type License = z.infer<typeof LicenseSchema>;

// License validation result
export interface LicenseValidationResult {
  valid: boolean;
  license?: License;
  reason?: string;
}

// License manager class
export class LicenseManager {
  private licenses = new Map<string, License>(); // guildId -> license

  /**
   * Register a license for a guild
   */
  registerLicense(license: License): boolean {
    try {
      // Validate license
      LicenseSchema.parse(license);

      // Check if license is expired
      if (license.expiresAt && license.expiresAt < new Date()) {
        throw new Error("License has expired");
      }

      // Check if license is revoked
      if (license.revokedAt) {
        throw new Error("License has been revoked");
      }

      this.licenses.set(license.guildId, license);
      return true;
    } catch (error) {
      console.error("Failed to register license:", error);
      return false;
    }
  }

  /**
   * Revoke a license
   */
  revokeLicense(guildId: string): boolean {
    const license = this.licenses.get(guildId);
    if (!license) return false;

    license.revokedAt = new Date();
    return true;
  }

  /**
   * Check if a guild has a valid license for a feature
   */
  validateFeatureAccess(
    guildId: string,
    featureKey: string
  ): LicenseValidationResult {
    const license = this.licenses.get(guildId);

    if (!license) {
      return {
        valid: false,
        reason: "No license found for this guild",
      };
    }

    // Check if license is expired
    if (license.expiresAt && license.expiresAt < new Date()) {
      return {
        valid: false,
        license,
        reason: "License has expired",
      };
    }

    // Check if license is revoked
    if (license.revokedAt) {
      return {
        valid: false,
        license,
        reason: "License has been revoked",
      };
    }

    // Check if feature is included in license
    if (!license.features.includes(featureKey)) {
      return {
        valid: false,
        license,
        reason: `Feature '${featureKey}' is not included in this license`,
      };
    }

    return {
      valid: true,
      license,
    };
  }

  /**
   * Get license for a guild
   */
  getLicense(guildId: string): License | undefined {
    return this.licenses.get(guildId);
  }

  /**
   * Check if a guild has premium access
   */
  hasPremiumAccess(guildId: string): boolean {
    const license = this.licenses.get(guildId);
    if (!license) return false;

    // Check validity
    const validation = this.validateFeatureAccess(guildId, "");
    return (
      validation.valid ||
      license.type === "premium" ||
      license.type === "enterprise"
    );
  }

  /**
   * Get all licenses (admin function)
   */
  getAllLicenses(): License[] {
    return Array.from(this.licenses.values());
  }

  /**
   * Clean up expired licenses
   */
  cleanupExpiredLicenses(): number {
    let cleaned = 0;
    const now = new Date();

    for (const [guildId, license] of this.licenses) {
      if (license.expiresAt && license.expiresAt < now) {
        this.licenses.delete(guildId);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Global license manager instance
export const licenseManager = new LicenseManager();
