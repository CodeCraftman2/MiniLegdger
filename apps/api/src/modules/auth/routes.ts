import {
  accessTokenResponseSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshSchema,
  tokenResponseSchema,
} from "@miniledger/shared";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Env } from "../../config/env";
import type { SmsProvider } from "../../lib/sms";
import { AuthService } from "./service";

export const authRoutes: FastifyPluginAsync<{ env: Env; sms: SmsProvider }> = async (fastify, { env, sms }) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const service = new AuthService(app.prisma, sms, env);

  app.post(
    "/otp/request",
    {
      config: { rateLimit: { max: env.OTP_RATE_LIMIT_MAX, timeWindow: "1 minute" } },
      schema: {
        tags: ["auth"],
        summary: "Send an OTP to the phone number (mock SMS: printed to the server log)",
        body: otpRequestSchema,
        response: { 200: z.object({ expiresInSeconds: z.number().int() }) },
      },
    },
    async (req) => {
      await service.requestOtp(req.body.phone);
      return { expiresInSeconds: env.OTP_TTL_SECONDS };
    },
  );

  app.post(
    "/otp/verify",
    {
      config: { rateLimit: { max: env.OTP_RATE_LIMIT_MAX, timeWindow: "1 minute" } },
      schema: {
        tags: ["auth"],
        summary: "Verify the OTP and receive access + refresh tokens",
        body: otpVerifySchema,
        response: { 200: tokenResponseSchema },
      },
    },
    async (req) => {
      const userId = await service.verifyOtp(req.body.phone, req.body.otp);
      return app.issueTokens(userId);
    },
  );

  app.post(
    "/refresh",
    {
      schema: {
        tags: ["auth"],
        summary: "Exchange a refresh token for a new access token",
        body: refreshSchema,
        response: { 200: accessTokenResponseSchema },
      },
    },
    async (req) => {
      const userId = app.verifyRefreshToken(req.body.refreshToken);
      return app.issueAccessToken(userId);
    },
  );
};
