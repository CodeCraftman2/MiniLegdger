import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { Env } from "./config/env";
import { ConsoleSmsProvider, type SmsProvider } from "./lib/sms";
import { authRoutes } from "./modules/auth/routes";
import { loanRoutes } from "./modules/loans/routes";
import { authPlugin } from "./plugins/auth";
import { dbPlugin } from "./plugins/db";
import { errorHandlerPlugin } from "./plugins/error-handler";

export async function buildApp(opts: { env: Env; sms?: SmsProvider }) {
  const { env } = opts;

  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : { level: "info", redact: ["req.headers.authorization"] },
    trustProxy: true, // behind Render / a load balancer, so rate limits see the real client IP
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: {
      info: { title: "MiniLedger API", version: "0.1.0", description: "Track money you've lent to friends." },
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await app.register(helmet, { contentSecurityPolicy: false }); // CSP off so Swagger UI's inline assets load
  await app.register(rateLimit, { max: env.RATE_LIMIT_MAX, timeWindow: "1 minute" });
  await app.register(errorHandlerPlugin);
  await app.register(dbPlugin, { databaseUrl: env.DATABASE_URL });
  await app.register(authPlugin, { env });

  const sms = opts.sms ?? new ConsoleSmsProvider(app.log);

  app.get("/health", { config: { rateLimit: false }, schema: { hide: true } }, async (_req, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch (err) {
      app.log.error({ err }, "health check failed");
      return reply.status(503).send({ status: "unavailable" });
    }
  });

  await app.register(authRoutes, { prefix: "/v1/auth", env, sms });
  await app.register(loanRoutes, { prefix: "/v1/loans" });

  return app;
}
