import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Env } from "../../config/env";
import { badRequest, tooManyRequests } from "../../lib/errors";
import type { SmsProvider } from "../../lib/sms";

const PER_PHONE_WINDOW_MS = 10 * 60 * 1000;

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sms: SmsProvider,
    private readonly env: Env,
  ) {}

  /** HMAC keyed by the server secret and bound to the phone, so a leaked row can't be brute-forced offline cheaply. */
  private hashCode(phone: string, code: string): string {
    return createHmac("sha256", this.env.JWT_SECRET).update(`${phone}:${code}`).digest("hex");
  }

  async requestOtp(phone: string): Promise<void> {
    const recent = await this.prisma.otpRequest.count({
      where: { phone, createdAt: { gt: new Date(Date.now() - PER_PHONE_WINDOW_MS) } },
    });
    if (recent >= this.env.OTP_MAX_PER_PHONE) {
      throw tooManyRequests("Too many OTP requests for this number. Try again in a few minutes.");
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.prisma.otpRequest.create({
      data: {
        phone,
        codeHash: this.hashCode(phone, code),
        expiresAt: new Date(Date.now() + this.env.OTP_TTL_SECONDS * 1000),
      },
    });
    await this.sms.sendOtp(phone, code);
  }

  /** Returns the user id when the OTP is correct. */
  async verifyOtp(phone: string, otp: string): Promise<string> {
    const record = await this.prisma.otpRequest.findFirst({
      where: { phone, consumed: false },
      orderBy: { createdAt: "desc" },
    });

    if (!record) throw badRequest("No active OTP for this number. Request a new one.", "otp");
    if (record.expiresAt.getTime() < Date.now()) {
      throw badRequest("This OTP has expired. Request a new one.", "otp");
    }
    if (record.attempts >= this.env.OTP_MAX_ATTEMPTS) {
      throw tooManyRequests("Too many wrong attempts. Request a new OTP.");
    }

    const expected = Buffer.from(record.codeHash, "hex");
    const actual = Buffer.from(this.hashCode(phone, otp), "hex");
    if (!timingSafeEqual(expected, actual)) {
      await this.prisma.otpRequest.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw badRequest("Incorrect OTP", "otp");
    }

    // Atomic consume: if two verifies race, only one wins.
    const consumed = await this.prisma.otpRequest.updateMany({
      where: { id: record.id, consumed: false },
      data: { consumed: true },
    });
    if (consumed.count === 0) throw badRequest("This OTP has already been used.", "otp");

    const user = await this.prisma.user.upsert({ where: { phone }, create: { phone }, update: {} });
    return user.id;
  }
}
