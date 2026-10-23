// Simple interest on the outstanding principal, with payments applied to interest first.
// Everything is integer paise; day counts come from plain YYYY-MM-DD dates (IST), so the
// API and the app always compute the same numbers.

import { daysBetween } from "./dates";

export type InterestPeriod = "MONTH" | "YEAR";

/** A "month" is a flat 30 days and a year is 365, so interest accrues evenly per day. */
export const PERIOD_DAYS: Record<InterestPeriod, number> = { MONTH: 30, YEAR: 365 };

export type PaymentLike = { amountPaise: number; paidOn: string; createdAt: string };

export type InterestTerms = {
  principalPaise: number;
  /** Hundredths of a percent per period: 200 = 2.00%. 0 means no interest. */
  rateBps: number;
  period: InterestPeriod;
  /** Day the money was lent (YYYY-MM-DD). Interest runs from here. */
  lentOn: string;
};

export type Balance = {
  /** Everything received so far (interest + principal). */
  paidPaise: number;
  principalPaidPaise: number;
  interestPaidPaise: number;
  principalDuePaise: number;
  /** Interest accrued but not yet paid. */
  interestDuePaise: number;
  /** Total still owed as of `asOf`. */
  owedPaise: number;
};

/** Interest for `days` on `principalPaise` at the given rate. */
export function interestFor(principalPaise: number, rateBps: number, period: InterestPeriod, days: number): number {
  if (principalPaise <= 0 || rateBps <= 0 || days <= 0) return 0;
  return Math.round(principalPaise * (rateBps / 10_000) * (days / PERIOD_DAYS[period]));
}

const byTime = (a: PaymentLike, b: PaymentLike) =>
  a.paidOn === b.paidOn ? a.createdAt.localeCompare(b.createdAt) : a.paidOn.localeCompare(b.paidOn);

/**
 * Walks the loan's history: interest accrues on the principal still outstanding, each payment
 * clears accrued interest first and only then reduces the principal.
 */
export function computeBalance(terms: InterestTerms, payments: readonly PaymentLike[], asOf: string): Balance {
  let principal = terms.principalPaise;
  let interestDue = 0;
  let principalPaid = 0;
  let interestPaid = 0;
  let cursor = terms.lentOn;

  const accrueTo = (date: string) => {
    if (date > cursor) {
      interestDue += interestFor(principal, terms.rateBps, terms.period, daysBetween(cursor, date));
      cursor = date;
    }
  };

  for (const p of [...payments].sort(byTime)) {
    accrueTo(p.paidOn);
    const toInterest = Math.min(p.amountPaise, interestDue);
    const toPrincipal = Math.min(p.amountPaise - toInterest, principal);
    interestDue -= toInterest;
    interestPaid += toInterest;
    principal -= toPrincipal;
    principalPaid += toPrincipal;
  }
  accrueTo(asOf);

  return {
    paidPaise: principalPaid + interestPaid,
    principalPaidPaise: principalPaid,
    interestPaidPaise: interestPaid,
    principalDuePaise: principal,
    interestDuePaise: interestDue,
    owedPaise: principal + interestDue,
  };
}

/** What you'd earn in interest if the loan runs `days` untouched. */
export function projectedInterest(principalPaise: number, rateBps: number, period: InterestPeriod, days: number) {
  return interestFor(principalPaise, rateBps, period, days);
}

/**
 * The rate (in hundredths of a percent per period) that earns `targetInterestPaise`
 * on `principalPaise` over `days`. Returns null when it can't be worked out.
 */
export function rateForTargetInterest(
  principalPaise: number,
  targetInterestPaise: number,
  days: number,
  period: InterestPeriod,
): number | null {
  if (principalPaise <= 0 || targetInterestPaise <= 0 || days <= 0) return null;
  const bps = (targetInterestPaise * 10_000 * PERIOD_DAYS[period]) / (principalPaise * days);
  return Math.round(bps);
}

/** "2%" / "1.25%" style label; trailing zeros are dropped. */
export function formatRate(rateBps: number): string {
  const pct = rateBps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0$/, "")}%`;
}

export function formatRatePerPeriod(rateBps: number, period: InterestPeriod): string {
  return `${formatRate(rateBps)} per ${period === "MONTH" ? "month" : "year"}`;
}
