import { daysBetween, isOverdue, type Loan } from "@miniledger/shared";
import type { Loan as DbLoan } from "@prisma/client";

/** Postgres DATE comes back as a Date at UTC midnight; slice gives the plain calendar date. */
export const toDateString = (d: Date) => d.toISOString().slice(0, 10);
export const fromDateString = (s: string) => new Date(`${s}T00:00:00.000Z`);

export function serializeLoan(loan: DbLoan, today: string): Loan {
  const dueDate = toDateString(loan.dueDate);
  const repaidAt = loan.repaidAt ? loan.repaidAt.toISOString() : null;
  const overdue = isOverdue(dueDate, repaidAt, today);
  return {
    id: loan.id,
    friendName: loan.friendName,
    amountPaise: loan.amountPaise,
    dueDate,
    repaidAt,
    createdAt: loan.createdAt.toISOString(),
    overdue,
    daysOverdue: overdue ? daysBetween(dueDate, today) : 0,
  };
}
