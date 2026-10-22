import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeApp, uniquePhone, type CaptureSms, type TestApp } from "./helpers";

let app: TestApp;
let sms: CaptureSms;

beforeAll(async () => {
  ({ app, sms } = await makeApp());
});
afterAll(async () => {
  await app.close();
});

const request = (phone: string) => app.inject({ method: "POST", url: "/v1/auth/otp/request", payload: { phone } });
const verify = (phone: string, otp: string) =>
  app.inject({ method: "POST", url: "/v1/auth/otp/verify", payload: { phone, otp } });

describe("OTP auth", () => {
  it("issues tokens for the right code and stores only a hash", async () => {
    const phone = uniquePhone();
    expect((await request(phone)).statusCode).toBe(200);
    const code = sms.codes.get(phone)!;

    const row = await app.prisma.otpRequest.findFirstOrThrow({ where: { phone } });
    expect(row.codeHash).not.toContain(code);

    const res = await verify(phone, code);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ expiresIn: 900 });
    expect(res.json().accessToken).toBeTruthy();
    expect(res.json().refreshToken).toBeTruthy();
  });

  it("rejects an OTP that has expired", async () => {
    const phone = uniquePhone();
    await request(phone);
    await app.prisma.otpRequest.updateMany({ where: { phone }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await verify(phone, sms.codes.get(phone)!);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatchObject({ code: "BAD_REQUEST_ERROR", field: "otp" });
    expect(res.json().error.description).toMatch(/expired/i);
  });

  it("locks out after 5 wrong attempts, even for the correct code", async () => {
    const phone = uniquePhone();
    await request(phone);
    const correct = sms.codes.get(phone)!;
    const wrong = correct === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i++) {
      const res = await verify(phone, wrong);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.description).toMatch(/incorrect/i);
    }

    const locked = await verify(phone, correct);
    expect(locked.statusCode).toBe(429);
    expect(locked.json().error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("does not allow an OTP to be used twice", async () => {
    const phone = uniquePhone();
    await request(phone);
    const code = sms.codes.get(phone)!;
    expect((await verify(phone, code)).statusCode).toBe(200);
    expect((await verify(phone, code)).statusCode).toBe(400);
  });

  it("limits OTP requests per phone number", async () => {
    const phone = uniquePhone();
    for (let i = 0; i < 3; i++) expect((await request(phone)).statusCode).toBe(200);
    expect((await request(phone)).statusCode).toBe(429);
  });

  it("rejects malformed phone numbers with a field-level error", async () => {
    const res = await request("12345");
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatchObject({ code: "BAD_REQUEST_ERROR", field: "phone" });
  });

  it("refreshes an access token, and rejects an access token used as a refresh token", async () => {
    const phone = uniquePhone();
    await request(phone);
    const tokens = (await verify(phone, sms.codes.get(phone)!)).json();

    const ok = await app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: tokens.refreshToken } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().accessToken).toBeTruthy();

    const bad = await app.inject({ method: "POST", url: "/v1/auth/refresh", payload: { refreshToken: tokens.accessToken } });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error.code).toBe("AUTHENTICATION_ERROR");
  });

  it("rejects a refresh token used as an access token", async () => {
    const phone = uniquePhone();
    await request(phone);
    const tokens = (await verify(phone, sms.codes.get(phone)!)).json();
    const res = await app.inject({
      method: "GET",
      url: "/v1/loans",
      headers: { authorization: `Bearer ${tokens.refreshToken}` },
    });
    expect(res.statusCode).toBe(401);
  });
});
