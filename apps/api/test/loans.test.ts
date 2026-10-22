import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, auth, login, makeApp, today, type CaptureSms, type TestApp } from "./helpers";

let app: TestApp;
let sms: CaptureSms;

beforeAll(async () => {
  ({ app, sms } = await makeApp());
});
afterAll(async () => {
  await app.close();
});

const createLoan = (token: string, payload: object, headers: Record<string, string> = {}) =>
  app.inject({ method: "POST", url: "/v1/loans", headers: { ...auth(token), ...headers }, payload });

/** The API rejects past due dates, so overdue fixtures are written straight to the database. */
async function seedLoan(phone: string, data: { amountPaise: number; dueDate: string; repaid?: boolean }) {
  const user = await app.prisma.user.findUniqueOrThrow({ where: { phone } });
  return app.prisma.loan.create({
    data: {
      userId: user.id,
      friendName: "Seeded",
      amountPaise: data.amountPaise,
      dueDate: new Date(`${data.dueDate}T00:00:00.000Z`),
      repaidAt: data.repaid ? new Date() : null,
    },
  });
}

describe("summary", () => {
  it("adds up lent, repaid and overdue in one query", async () => {
    const { accessToken, phone } = await login(app, sms);
    await seedLoan(phone, { amountPaise: 100_00, dueDate: addDays(today(), 10) }); // upcoming
    await seedLoan(phone, { amountPaise: 250_00, dueDate: addDays(today(), -3) }); // overdue
    await seedLoan(phone, { amountPaise: 50_50, dueDate: addDays(today(), -1) }); // overdue
    await seedLoan(phone, { amountPaise: 400_00, dueDate: addDays(today(), -9), repaid: true }); // repaid, was late

    const res = await app.inject({ method: "GET", url: "/v1/loans/summary", headers: auth(accessToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      totalLentPaise: 800_50,
      totalRepaidPaise: 400_00,
      overduePaise: 300_50,
      overdueCount: 2,
    });
  });

  it("is all zeros for a new user", async () => {
    const { accessToken } = await login(app, sms);
    const res = await app.inject({ method: "GET", url: "/v1/loans/summary", headers: auth(accessToken) });
    expect(res.json()).toEqual({ totalLentPaise: 0, totalRepaidPaise: 0, overduePaise: 0, overdueCount: 0 });
  });
});

describe("overdue boundary", () => {
  it("treats a loan due today as NOT overdue and one due yesterday as overdue", async () => {
    const { accessToken, phone } = await login(app, sms);
    await seedLoan(phone, { amountPaise: 100_00, dueDate: today() });
    await seedLoan(phone, { amountPaise: 200_00, dueDate: addDays(today(), -1) });

    const all = (await app.inject({ method: "GET", url: "/v1/loans", headers: auth(accessToken) })).json();
    const dueToday = all.items.find((l: { dueDate: string }) => l.dueDate === today());
    const dueYesterday = all.items.find((l: { dueDate: string }) => l.dueDate === addDays(today(), -1));
    expect(dueToday).toMatchObject({ overdue: false, daysOverdue: 0 });
    expect(dueYesterday).toMatchObject({ overdue: true, daysOverdue: 1 });

    const overdue = (
      await app.inject({ method: "GET", url: "/v1/loans?status=overdue", headers: auth(accessToken) })
    ).json();
    expect(overdue.items).toHaveLength(1);
    expect(overdue.items[0].dueDate).toBe(addDays(today(), -1));

    const summary = (await app.inject({ method: "GET", url: "/v1/loans/summary", headers: auth(accessToken) })).json();
    expect(summary).toMatchObject({ overdueCount: 1, overduePaise: 200_00 });
  });

  it("never reports a repaid loan as overdue", async () => {
    const { accessToken, phone } = await login(app, sms);
    await seedLoan(phone, { amountPaise: 100_00, dueDate: addDays(today(), -5), repaid: true });
    const res = (await app.inject({ method: "GET", url: "/v1/loans?status=overdue", headers: auth(accessToken) })).json();
    expect(res.items).toHaveLength(0);
  });
});

describe("repay", () => {
  it("is safe to call twice and keeps the first repaidAt", async () => {
    const { accessToken } = await login(app, sms);
    const loan = (await createLoan(accessToken, { friendName: "Asha", amountPaise: 500_00, dueDate: today() })).json();

    const first = await app.inject({ method: "PATCH", url: `/v1/loans/${loan.id}/repay`, headers: auth(accessToken) });
    const second = await app.inject({ method: "PATCH", url: `/v1/loans/${loan.id}/repay`, headers: auth(accessToken) });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json().repaidAt).toBeTruthy();
    expect(second.json().repaidAt).toBe(first.json().repaidAt);

    const summary = (await app.inject({ method: "GET", url: "/v1/loans/summary", headers: auth(accessToken) })).json();
    expect(summary.totalRepaidPaise).toBe(500_00);
  });

  it("returns 404 for a loan that does not exist", async () => {
    const { accessToken } = await login(app, sms);
    const res = await app.inject({ method: "PATCH", url: "/v1/loans/nope/repay", headers: auth(accessToken) });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND_ERROR");
  });
});

describe("data isolation", () => {
  it("stops user A from seeing or repaying user B's loans", async () => {
    const a = await login(app, sms);
    const b = await login(app, sms);
    const loan = (await createLoan(b.accessToken, { friendName: "Bob's friend", amountPaise: 900_00, dueDate: today() })).json();

    const listA = (await app.inject({ method: "GET", url: "/v1/loans", headers: auth(a.accessToken) })).json();
    expect(listA.items).toHaveLength(0);

    const summaryA = (await app.inject({ method: "GET", url: "/v1/loans/summary", headers: auth(a.accessToken) })).json();
    expect(summaryA.totalLentPaise).toBe(0);

    const repay = await app.inject({ method: "PATCH", url: `/v1/loans/${loan.id}/repay`, headers: auth(a.accessToken) });
    expect(repay.statusCode).toBe(404);

    const listB = (await app.inject({ method: "GET", url: "/v1/loans", headers: auth(b.accessToken) })).json();
    expect(listB.items).toHaveLength(1);
    expect(listB.items[0].repaidAt).toBeNull();
  });

  it("requires authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/loans" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("AUTHENTICATION_ERROR");
  });
});

describe("creating loans", () => {
  it("does not create a duplicate when the same Idempotency-Key is replayed", async () => {
    const { accessToken } = await login(app, sms);
    const payload = { friendName: "Ravi", amountPaise: 120_000, dueDate: addDays(today(), 7) };
    const headers = { "idempotency-key": "tap-1" };

    const first = await createLoan(accessToken, payload, headers);
    const second = await createLoan(accessToken, payload, headers);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);

    const list = (await app.inject({ method: "GET", url: "/v1/loans", headers: auth(accessToken) })).json();
    expect(list.items).toHaveLength(1);
  });

  it("survives two identical requests arriving at the same time", async () => {
    const { accessToken } = await login(app, sms);
    const payload = { friendName: "Meera", amountPaise: 75_000, dueDate: addDays(today(), 2) };
    const results = await Promise.all([
      createLoan(accessToken, payload, { "idempotency-key": "race" }),
      createLoan(accessToken, payload, { "idempotency-key": "race" }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 201]);
    const list = (await app.inject({ method: "GET", url: "/v1/loans", headers: auth(accessToken) })).json();
    expect(list.items).toHaveLength(1);
  });

  it("rejects a past due date with a field-level error", async () => {
    const { accessToken } = await login(app, sms);
    const res = await createLoan(accessToken, { friendName: "Late", amountPaise: 100_00, dueDate: addDays(today(), -1) });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: { code: "BAD_REQUEST_ERROR", description: "Due date can't be in the past", field: "dueDate" },
    });
  });

  it("rejects float amounts", async () => {
    const { accessToken } = await login(app, sms);
    const res = await createLoan(accessToken, { friendName: "Float", amountPaise: 10.5, dueDate: today() });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.field).toBe("amountPaise");
  });
});

describe("pagination", () => {
  it("walks through pages with a cursor", async () => {
    const { accessToken, phone } = await login(app, sms);
    for (let i = 0; i < 5; i++) await seedLoan(phone, { amountPaise: 100_00 + i, dueDate: addDays(today(), i) });

    const p1 = (await app.inject({ method: "GET", url: "/v1/loans?limit=2", headers: auth(accessToken) })).json();
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toBeTruthy();

    const p2 = (await app.inject({ method: "GET", url: `/v1/loans?limit=2&cursor=${p1.nextCursor}`, headers: auth(accessToken) })).json();
    const p3 = (await app.inject({ method: "GET", url: `/v1/loans?limit=2&cursor=${p2.nextCursor}`, headers: auth(accessToken) })).json();
    expect(p3.items).toHaveLength(1);
    expect(p3.nextCursor).toBeNull();

    const ids = [...p1.items, ...p2.items, ...p3.items].map((l: { id: string }) => l.id);
    expect(new Set(ids).size).toBe(5);
  });
});

describe("health", () => {
  it("reports ok when the database is reachable", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
