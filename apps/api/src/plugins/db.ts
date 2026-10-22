import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const dbPlugin = fp<{ databaseUrl: string }>(async (app, opts) => {
  const prisma = new PrismaClient({ datasourceUrl: opts.databaseUrl });
  await prisma.$connect();
  app.decorate("prisma", prisma);
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
