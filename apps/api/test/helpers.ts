import { todayIST } from "@miniledger/shared";
import { buildApp } from "../src/app";
import { loadEnv } from "../src/config/env";
import type { SmsProvider } from "../src/lib/sms";

/** Captures OTPs in memory instead of logging them, so tests can read the code. */
export class CaptureSms implements SmsProvider {
  codes = new Map<string, string>();
  async sendOtp(phone: string, code: string) {
    this.codes.set(phone, code);
  }
}

export async function makeApp() {
  const sms = new CaptureSms();
  const app = await buildApp({ env: loadEnv(), sms });
  await app.ready();
  return { app, sms };
}

export type TestApp = Awaited<ReturnType<typeof makeApp>>["app"];

let counter = 0;
/** A unique valid Indian mobile number per call. */
export function uniquePhone() {
  counter += 1;
  return `+9198${String(Date.now() % 100000).padStart(5, "0")}${String(counter).padStart(3, "0")}`.slice(0, 13);
}

export async function login(app: TestApp, sms: CaptureSms, phone = uniquePhone()) {
  await app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone } });
  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/otp/verify",
    payload: { phone, otp: sms.codes.get(phone) },
  });
  const body = res.json();
  return { phone, accessToken: body.accessToken as string, refreshToken: body.refreshToken as string };
}

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const today = () => todayIST();
