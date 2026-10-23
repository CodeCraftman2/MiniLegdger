import { describe, expect, it } from "vitest";
import {
  buildUpiUri,
  computeBalance,
  daysBetween,
  formatRate,
  formatRupees,
  interestFor,
  isOverdue,
  isValidUpiId,
  parseRupeesToPaise,
  rateForTargetInterest,
  todayIST,
} from "./index";

describe("formatRupees", () => {
  it("uses Indian digit grouping", () => {
    expect(formatRupees(0)).toBe("₹0");
    expect(formatRupees(99_900)).toBe("₹999");
    expect(formatRupees(1_000_00)).toBe("₹1,000");
    expect(formatRupees(1_23_456_00)).toBe("₹1,23,456");
    expect(formatRupees(12_34_56_789_00)).toBe("₹12,34,56,789");
    expect(formatRupees(150_50)).toBe("₹150.50");
  });
});

describe("parseRupeesToPaise", () => {
  it("converts without floating point drift", () => {
    expect(parseRupeesToPaise("1,250.50")).toBe(125_050);
    expect(parseRupeesToPaise("0.1")).toBe(10);
    expect(parseRupeesToPaise("19.99")).toBe(1999);
    expect(parseRupeesToPaise("abc")).toBeNull();
    expect(parseRupeesToPaise("1.234")).toBeNull();
  });
});

describe("dates", () => {
  it("computes the IST date across the UTC boundary", () => {
    // 20:00 UTC on the 1st is already 01:30 on the 2nd in Kolkata.
    expect(todayIST(new Date("2025-03-01T20:00:00Z"))).toBe("2025-03-02");
    expect(todayIST(new Date("2025-03-01T18:29:00Z"))).toBe("2025-03-01");
  });

  it("treats due-today as not overdue", () => {
    expect(isOverdue("2025-03-02", null, "2025-03-02")).toBe(false);
    expect(isOverdue("2025-03-01", null, "2025-03-02")).toBe(true);
    expect(isOverdue("2025-03-01", "2025-03-01T00:00:00Z", "2025-03-02")).toBe(false);
    expect(daysBetween("2025-02-28", "2025-03-06")).toBe(6);
  });
});

describe("interest-free loans", () => {
  const terms = { principalPaise: 1000_00, rateBps: 0, period: "MONTH" as const, lentOn: "2025-01-01" };
  const pay = (amountPaise: number, paidOn: string) => ({ amountPaise, paidOn, createdAt: `${paidOn}T00:00:00Z` });

  it("lent 1000, received 100 leaves 900", () => {
    const b = computeBalance(terms, [pay(100_00, "2025-01-05")], "2025-02-01");
    expect(b).toMatchObject({ paidPaise: 100_00, principalDuePaise: 900_00, interestDuePaise: 0, owedPaise: 900_00 });
  });

  it("is settled once the payments add up", () => {
    const b = computeBalance(terms, [pay(100_00, "2025-01-05"), pay(900_00, "2025-01-09")], "2025-03-01");
    expect(b.owedPaise).toBe(0);
  });
});

describe("simple interest", () => {
  // 2% a month on 10,000 for 30 days is exactly 200.
  const terms = { principalPaise: 10_000_00, rateBps: 200, period: "MONTH" as const, lentOn: "2025-01-01" };
  const pay = (amountPaise: number, paidOn: string) => ({ amountPaise, paidOn, createdAt: `${paidOn}T00:00:00Z` });

  it("accrues per day", () => {
    expect(interestFor(10_000_00, 200, "MONTH", 30)).toBe(200_00);
    expect(interestFor(10_000_00, 1200, "YEAR", 365)).toBe(1200_00);
    expect(computeBalance(terms, [], "2025-01-31")).toMatchObject({ interestDuePaise: 200_00, owedPaise: 10_200_00 });
  });

  it("applies a payment to interest first, then principal", () => {
    // After 30 days 200 interest is due. Paying 1,200 clears it and takes 1,000 off the principal.
    const b = computeBalance(terms, [pay(1_200_00, "2025-01-31")], "2025-01-31");
    expect(b).toMatchObject({ interestPaidPaise: 200_00, principalPaidPaise: 1_000_00, principalDuePaise: 9_000_00, owedPaise: 9_000_00 });
  });

  it("charges interest only on what is still outstanding", () => {
    // Principal drops to 9,000 on day 30, so the next 30 days cost 180, not 200.
    const b = computeBalance(terms, [pay(1_200_00, "2025-01-31")], "2025-03-02");
    expect(b.interestDuePaise).toBe(180_00);
    expect(b.owedPaise).toBe(9_180_00);
  });

  it("a payment smaller than the interest leaves interest due and the principal untouched", () => {
    const b = computeBalance(terms, [pay(50_00, "2025-01-31")], "2025-01-31");
    expect(b).toMatchObject({ interestPaidPaise: 50_00, principalPaidPaise: 0, interestDuePaise: 150_00, principalDuePaise: 10_000_00 });
  });
});

describe("rate planner", () => {
  it("finds the rate that earns the target", () => {
    // Earn 500 on 10,000 over 6 months (180 days): about 0.83% a month, or 10% a year.
    expect(rateForTargetInterest(10_000_00, 500_00, 180, "MONTH")).toBe(83);
    expect(rateForTargetInterest(10_000_00, 500_00, 182.5, "YEAR")).toBe(1000);
    expect(rateForTargetInterest(10_000_00, 500_00, 0, "MONTH")).toBeNull();
    expect(rateForTargetInterest(0, 500_00, 30, "MONTH")).toBeNull();
  });

  it("round-trips to roughly the target", () => {
    const bps = rateForTargetInterest(25_000_00, 1_000_00, 90, "MONTH")!;
    const earned = interestFor(25_000_00, bps, "MONTH", 90);
    expect(Math.abs(earned - 1_000_00)).toBeLessThan(25_00);
  });

  it("formats rates", () => {
    expect(formatRate(200)).toBe("2%");
    expect(formatRate(167)).toBe("1.67%");
    expect(formatRate(150)).toBe("1.5%");
  });
});

describe("UPI payment links", () => {
  it("validates UPI ids", () => {
    expect(isValidUpiId("rahul@oksbi")).toBe(true);
    expect(isValidUpiId("9876543210@ybl")).toBe(true);
    expect(isValidUpiId(" asha.k-1@paytm ")).toBe(true);
    expect(isValidUpiId("no-at-sign")).toBe(false);
    expect(isValidUpiId("a@b")).toBe(false);
    expect(isValidUpiId("two@@bank")).toBe(false);
  });

  it("builds a link with the exact amount in rupees", () => {
    const uri = buildUpiUri({ upiId: "asha@oksbi", payeeName: "Asha K", amountPaise: 90_050, note: "MiniLedger" });
    expect(uri).toBe("upi://pay?pa=asha%40oksbi&pn=Asha%20K&am=900.50&cu=INR&tn=MiniLedger");
    expect(buildUpiUri({ upiId: "a@b1", payeeName: "", amountPaise: 5 })).toBe("upi://pay?pa=a%40b1&pn=Payee&am=0.05&cu=INR");
  });
});
