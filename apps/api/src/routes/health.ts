import type { FastifyInstance } from "fastify";

export default async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get("/health", async (request, reply) => {
    return {
      success: true,
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      },
      requestId: request.id,
    };
  });

  // Detailed health check with dependencies
  fastify.get("/health/detailed", async (request, reply) => {
    const checks = {
      database: "pending",
      redis: "pending",
      memory: "ok",
      uptime: process.uptime(),
    };

    // TODO: Add actual DB and Redis health checks when implemented
    // For now, return basic system health
    const memUsage = process.memoryUsage();

    return {
      success: true,
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
        checks,
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024) + " MB",
          total: Math.round(memUsage.heapTotal / 1024 / 1024) + " MB",
          external: Math.round(memUsage.external / 1024 / 1024) + " MB",
        },
        uptime: `${Math.floor(process.uptime())} seconds`,
      },
      requestId: request.id,
    };
  });
}
