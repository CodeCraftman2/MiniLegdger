import { describe, expect, it } from "vitest";
import { daysBetween, formatRupees, isOverdue, parseRupeesToPaise, todayIST } from "./index";

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
