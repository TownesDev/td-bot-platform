import type { FastifyInstance } from "fastify";
import { z } from "zod";

// Mock license data for development - replace with actual license service later
const MOCK_LICENSES = {
  trial_placeholder: {
    plan: "trial" as const,
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    features: ["welcome", "xp", "basic-moderation"],
    limits: {
      maxGuilds: 1,
      aiTokensDaily: 1000,
    },
  },
  bronze_test: {
    plan: "bronze" as const,
    isActive: true,
    expiresAt: null,
    features: ["welcome", "xp", "moderation", "announcements"],
    limits: {
      maxGuilds: 3,
      aiTokensDaily: 5000,
    },
  },
  silver_test: {
    plan: "silver" as const,
    isActive: true,
    expiresAt: null,
    features: ["welcome", "xp", "moderation", "announcements", "ai-concierge"],
    limits: {
      maxGuilds: 10,
      aiTokensDaily: 25000,
    },
  },
} as const;

// Request/Response schemas
const LicenseActivateRequestSchema = z.object({
  licenseKey: z.string().min(1, "License key is required"),
  guildId: z.string().optional(),
});

const LicenseRefreshRequestSchema = z.object({
  licenseKey: z.string().min(1),
  tenantId: z.string().optional(),
});

export default async function licenseRoutes(fastify: FastifyInstance) {
  // POST /licenses/activate - Activate and validate a license
  fastify.post(
    "/activate",
    {
      schema: {
        body: {
          type: "object",
          required: ["licenseKey"],
          properties: {
            licenseKey: { type: "string", minLength: 1 },
            guildId: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { licenseKey, guildId } = LicenseActivateRequestSchema.parse(
          request.body
        );

        // Mock license validation - replace with actual license service
        const licenseData =
          MOCK_LICENSES[licenseKey as keyof typeof MOCK_LICENSES];

        if (!licenseData) {
          return reply.status(404).send({
            success: false,
            error: {
              code: "LICENSE_NOT_FOUND",
              message: "Invalid or expired license key",
            },
            requestId: request.id,
          });
        }

        if (!licenseData.isActive) {
          return reply.status(403).send({
            success: false,
            error: {
              code: "LICENSE_INACTIVE",
              message: "License is not active",
            },
            requestId: request.id,
          });
        }

        // Check if trial has expired
        if (
          licenseData.expiresAt &&
          new Date(licenseData.expiresAt) < new Date()
        ) {
          return reply.status(403).send({
            success: false,
            error: {
              code: "LICENSE_EXPIRED",
              message: "Trial license has expired",
            },
            requestId: request.id,
          });
        }

        request.log.info(
          {
            licenseKey,
            plan: licenseData.plan,
            guildId,
          },
          "license activated successfully"
        );

        return {
          success: true,
          message: "License activated successfully",
          license: {
            plan: licenseData.plan,
            isActive: licenseData.isActive,
            expiresAt: licenseData.expiresAt,
            features: licenseData.features,
            limits: licenseData.limits,
            refreshInSec: 3600, // Refresh every hour
          },
          requestId: request.id,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request data",
              details: error.errors,
            },
            requestId: request.id,
          });
        }
        throw error;
      }
    }
  );

  // POST /licenses/refresh - Refresh license status
  fastify.post(
    "/refresh",
    {
      schema: {
        body: {
          type: "object",
          required: ["licenseKey"],
          properties: {
            licenseKey: { type: "string", minLength: 1 },
            tenantId: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { licenseKey, tenantId } = LicenseRefreshRequestSchema.parse(
          request.body
        );

        // Mock license refresh - same logic as activate for now
        const licenseData =
          MOCK_LICENSES[licenseKey as keyof typeof MOCK_LICENSES];

        if (!licenseData) {
          return reply.status(404).send({
            success: false,
            error: {
              code: "LICENSE_NOT_FOUND",
              message: "Invalid or expired license key",
            },
            requestId: request.id,
          });
        }

        request.log.info(
          {
            licenseKey,
            tenantId,
            plan: licenseData.plan,
          },
          "license refreshed successfully"
        );

        return {
          success: true,
          message: "License refreshed successfully",
          license: {
            plan: licenseData.plan,
            isActive: licenseData.isActive,
            expiresAt: licenseData.expiresAt,
            features: licenseData.features,
            limits: licenseData.limits,
            refreshInSec: 3600,
          },
          requestId: request.id,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request data",
              details: error.errors,
            },
            requestId: request.id,
          });
        }
        throw error;
      }
    }
  );

  // GET /licenses/validate/:licenseKey - Quick validation endpoint
  fastify.get("/validate/:licenseKey", async (request, reply) => {
    const { licenseKey } = request.params as { licenseKey: string };

    const licenseData = MOCK_LICENSES[licenseKey as keyof typeof MOCK_LICENSES];

    if (!licenseData) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "LICENSE_NOT_FOUND",
          message: "Invalid license key",
        },
        requestId: request.id,
      });
    }

    return {
      success: true,
      data: {
        isValid: licenseData.isActive,
        plan: licenseData.plan,
        expiresAt: licenseData.expiresAt,
      },
      requestId: request.id,
    };
  });
}
