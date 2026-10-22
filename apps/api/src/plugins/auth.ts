import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import { unauthorized } from "../lib/errors";
import type { Env } from "../config/env";

type TokenType = "access" | "refresh";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; typ: TokenType };
    user: { sub: string; typ: TokenType };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest) => Promise<void>;
    issueTokens: (userId: string) => { accessToken: string; refreshToken: string; expiresIn: number };
    issueAccessToken: (userId: string) => { accessToken: string; expiresIn: number };
    verifyRefreshToken: (token: string) => string;
  }
}

export const authPlugin = fp<{ env: Env }>(async (app, { env }) => {
  await app.register(jwt, { secret: env.JWT_SECRET });

  app.decorate("issueAccessToken", (userId: string) => ({
    accessToken: app.jwt.sign({ sub: userId, typ: "access" }, { expiresIn: env.ACCESS_TOKEN_TTL_SECONDS }),
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  }));

  app.decorate("issueTokens", (userId: string) => ({
    ...app.issueAccessToken(userId),
    refreshToken: app.jwt.sign({ sub: userId, typ: "refresh" }, { expiresIn: env.REFRESH_TOKEN_TTL_SECONDS }),
  }));

  app.decorate("verifyRefreshToken", (token: string) => {
    try {
      const payload = app.jwt.verify<{ sub: string; typ: TokenType }>(token);
      if (payload.typ !== "refresh") throw new Error("wrong token type");
      return payload.sub;
    } catch {
      throw unauthorized("Refresh token is invalid or expired");
    }
  });

  app.decorate("authenticate", async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw unauthorized("Access token is missing, invalid or expired");
    }
    if (req.user.typ !== "access") throw unauthorized("Access token is required");
  });
});
