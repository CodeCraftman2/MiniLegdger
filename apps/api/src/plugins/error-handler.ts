import fp from "fastify-plugin";
import { AppError } from "../lib/errors";

type ValidationIssue = {
  instancePath?: string;
  message?: string;
  params?: { issue?: { path?: (string | number)[] } };
};

/** Maps every failure to { error: { code, description, field? } }. */
export const errorHandlerPlugin = fp(async (app) => {
  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
      error: { code: "NOT_FOUND_ERROR", description: `Route ${req.method} ${req.url.split("?")[0]} not found` },
    });
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        error: { code: err.code, description: err.description, ...(err.field && { field: err.field }) },
      });
    }

    const e = err as { validation?: ValidationIssue[]; statusCode?: number; message: string };

    if (e.validation?.length) {
      const first = e.validation[0]!;
      const path = first.params?.issue?.path ?? first.instancePath?.split("/").filter(Boolean) ?? [];
      const field = path.length ? String(path[path.length - 1]) : undefined;
      return reply.status(400).send({
        error: {
          code: "BAD_REQUEST_ERROR",
          description: first.message ?? "Invalid request",
          ...(field && { field }),
        },
      });
    }

    if (e.statusCode === 429) {
      return reply.status(429).send({
        error: { code: "TOO_MANY_REQUESTS", description: "Too many requests, please slow down" },
      });
    }

    if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
      return reply.status(e.statusCode).send({
        error: { code: "BAD_REQUEST_ERROR", description: e.message },
      });
    }

    req.log.error({ err }, "unhandled error");
    return reply.status(500).send({
      error: { code: "SERVER_ERROR", description: "Something went wrong on our side" },
    });
  });
});
