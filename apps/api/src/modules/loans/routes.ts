import { createLoanSchema, listLoansQuerySchema, loanListSchema, loanSchema, summarySchema } from "@miniledger/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { LoansService } from "./service";

const security = [{ bearerAuth: [] }];

export const loanRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const service = new LoansService(app.prisma);

  app.addHook("onRequest", app.authenticate);

  app.get(
    "/",
    {
      schema: {
        tags: ["loans"],
        security,
        summary: "List loans (cursor paginated)",
        querystring: listLoansQuerySchema,
        response: { 200: loanListSchema },
      },
    },
    async (req) => service.list(req.user.sub, req.query),
  );

  // Registered before "/:id/..." routes; static segments win in find-my-way anyway.
  app.get(
    "/summary",
    {
      schema: {
        tags: ["loans"],
        security,
        summary: "Totals lent, repaid and overdue (computed in SQL)",
        response: { 200: summarySchema },
      },
    },
    async (req) => service.summary(req.user.sub),
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["loans"],
        security,
        summary: "Add a loan. Send an Idempotency-Key header to make retries safe.",
        headers: z.object({ "idempotency-key": z.string().min(1).max(128).optional() }),
        body: createLoanSchema,
        response: { 200: loanSchema, 201: loanSchema },
      },
    },
    async (req, reply) => {
      const { loan, created } = await service.create(req.user.sub, req.body, req.headers["idempotency-key"]);
      return reply.status(created ? 201 : 200).send(loan);
    },
  );

  app.patch(
    "/:id/repay",
    {
      schema: {
        tags: ["loans"],
        security,
        summary: "Mark a loan as repaid (idempotent)",
        params: z.object({ id: z.string().min(1) }),
        response: { 200: loanSchema },
      },
    },
    async (req) => service.repay(req.user.sub, req.params.id),
  );
};
