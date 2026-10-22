import type { FastifyBaseLogger } from "fastify";

/**
 * Anything that can deliver an OTP. A real integration (MSG91, Twilio, AWS SNS...)
 * implements this one method and is swapped in where the app is built.
 */
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

/** Mock provider: prints the OTP to the server log instead of sending an SMS. */
export class ConsoleSmsProvider implements SmsProvider {
  constructor(private readonly log: FastifyBaseLogger) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    this.log.info({ phone, otp: code }, "[mock SMS] OTP generated");
  }
}
