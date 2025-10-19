import Fastify from "fastify";
import { nanoid } from "nanoid";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Environment schema for validation
const envSchema = {
  type: "object",
  required: ["DATABASE_URL", "REDIS_URL"],
  properties: {
    NODE_ENV: {
      type: "string",
      default: "development",
    },
    PORT: {
      type: "number",
      default: 3000,
    },
    HOST: {
      type: "string",
      default: "0.0.0.0",
    },
    DATABASE_URL: {
      type: "string",
    },
    REDIS_URL: {
      type: "string",
    },
    LOG_LEVEL: {
      type: "string",
      default: "info",
    },
  },
};

// Build Fastify server
export async function buildServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
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
    },
    requestIdLogLabel: "requestId",
    requestIdHeader: "x-request-id",
    genReqId: () => nanoid(),
  });

  // Environment variables validation
  await fastify.register(import("@fastify/env"), {
    schema: envSchema,
    dotenv: true,
  });

  // Security headers
  await fastify.register(import("@fastify/helmet"), {
    global: true,
    contentSecurityPolicy: false, // We'll configure this per route if needed
  });

  // CORS configuration
  await fastify.register(import("@fastify/cors"), {
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://townesdev.com", "https://app.townesdev.com"]
        : true,
    credentials: true,
  });

  // Rate limiting
  await fastify.register(import("@fastify/rate-limit"), {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: (request: FastifyRequest, context: any) => ({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Rate limit exceeded, retry in ${context.ttl} seconds`,
      },
      requestId: request.id,
    }),
  });

  // Health check and system monitoring
  await fastify.register(import("@fastify/under-pressure"), {
    maxEventLoopDelay: 1000,
    maxHeapUsedBytes: 100000000,
    maxRssBytes: 100000000,
    maxEventLoopUtilization: 0.98,
    healthCheck: async () => {
      // Basic health check - we can add DB/Redis checks later
      return { status: "ok", timestamp: new Date().toISOString() };
    },
    healthCheckInterval: 5000,
  });

  // Request/Response logging middleware
  fastify.addHook("onRequest", async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        headers: {
          "user-agent": request.headers["user-agent"],
          "x-forwarded-for": request.headers["x-forwarded-for"],
        },
      },
      "incoming request"
    );
  });

  fastify.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "request completed"
    );
  });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    request.log.error(
      {
        error: error.message,
        stack: error.stack,
        statusCode: error.statusCode,
      },
      "request error"
    );

    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: statusCode === 500 ? "Internal server error" : error.message,
      },
      requestId: request.id,
    };

    return reply.status(statusCode).send(response);
  });

  // Not found handler
  fastify.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
      },
      requestId: request.id,
    });
  });

  // Register routes
  await fastify.register(import("./routes/health.js"));
  await fastify.register(import("./routes/licenses.js"), {
    prefix: "/licenses",
  });
  await fastify.register(import("./routes/guilds.js"), { prefix: "/guilds" });
  await fastify.register(import("./routes/features.js"), {
    prefix: "/features",
  });

  return fastify;
}

// Start server
async function start() {
  try {
    const server = await buildServer();

    const host = process.env.HOST || "0.0.0.0";
    const port = parseInt(process.env.PORT || "3000", 10);

    await server.listen({ host, port });

    server.log.info(
      {
        port,
        host,
        env: process.env.NODE_ENV,
      },
      "Server started successfully"
    );
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Start the server
start();
