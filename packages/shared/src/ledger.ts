import { computeBalance, type Balance } from "./interest";
import { isOverdue, daysBetween, todayIST } from "./dates";
import type { Loan, Payment } from "./schemas";

/** Balance for a loan as of today, or frozen at the repaid date once it is settled. */
export function loanBalance(
  loan: Pick<Loan, "amountPaise" | "interestRateBps" | "interestPeriod" | "lentOn" | "payments" | "repaidAt">,
  today: string = todayIST(),
): Balance {
  // repaidAt is a UTC timestamp; shift to IST so "settled yesterday night" lands on the right day.
  const asOf = loan.repaidAt ? todayIST(new Date(loan.repaidAt)) : today;
  return computeBalance(
    {
      principalPaise: loan.amountPaise,
      rateBps: loan.interestRateBps,
      period: loan.interestPeriod,
      lentOn: loan.lentOn,
    },
    loan.payments,
    asOf < loan.lentOn ? loan.lentOn : asOf,
  );
}

/**
 * Returns the loan as it would look after `payment`, with the same maths the API runs.
 * Used for the optimistic update; the server's answer replaces it when it arrives.
 */
export function withPayment(loan: Loan, payment: Payment, today: string = todayIST()): Loan {
  const payments = [...loan.payments, payment];
  const balance = loanBalance({ ...loan, payments, repaidAt: null }, today);
  const repaid = balance.owedPaise === 0;
  const repaidAt = repaid ? new Date().toISOString() : null;
  const overdue = isOverdue(loan.dueDate, repaidAt, today);
  return {
    ...loan,
    payments,
    balance,
    repaidAt,
    overdue,
    daysOverdue: overdue ? daysBetween(loan.dueDate, today) : 0,
  };
}
