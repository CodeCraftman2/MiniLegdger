import { daysBetween, isOverdue, loanBalance, todayIST, type Loan, type Payment } from "@miniledger/shared";
import type { Loan as DbLoan, Payment as DbPayment } from "@prisma/client";

/** Postgres DATE comes back as a Date at UTC midnight; slice gives the plain calendar date. */
export const toDateString = (d: Date) => d.toISOString().slice(0, 10);
export const fromDateString = (s: string) => new Date(`${s}T00:00:00.000Z`);

export type DbLoanWithPayments = DbLoan & { payments: DbPayment[] };

export function serializePayment(p: DbPayment): Payment {
  return {
    id: p.id,
    amountPaise: p.amountPaise,
    paidOn: toDateString(p.paidOn),
    note: p.note,
    createdAt: p.createdAt.toISOString(),
  };
}

export function serializeLoan(loan: DbLoanWithPayments, today: string): Loan {
  const dueDate = toDateString(loan.dueDate);
  const repaidAt = loan.repaidAt ? loan.repaidAt.toISOString() : null;
  const overdue = isOverdue(dueDate, repaidAt, today);
  const payments = [...loan.payments]
    .sort((a, b) => a.paidOn.getTime() - b.paidOn.getTime() || a.createdAt.getTime() - b.createdAt.getTime())
    .map(serializePayment);
  const base = {
    amountPaise: loan.amountPaise,
    lentOn: todayIST(loan.createdAt), // the IST calendar day the loan was recorded
    interestRateBps: loan.interestRateBps,
    interestPeriod: loan.interestPeriod,
    payments,
    repaidAt,
  };
  return {
    id: loan.id,
    friendName: loan.friendName,
    dueDate,
    createdAt: loan.createdAt.toISOString(),
    overdue,
    daysOverdue: overdue ? daysBetween(dueDate, today) : 0,
    ...base,
    balance: loanBalance(base, today),
  };
}
