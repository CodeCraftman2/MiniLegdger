import {
  formatRupees,
  todayIST,
  type CreateLoanInput,
  type CreatePaymentInput,
  type Loan,
  type LoanList,
  type LoanStatus,
  type Summary,
} from "@miniledger/shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import { badRequest, notFound } from "../../lib/errors";
import { fromDateString, serializeLoan } from "../../lib/serialize";

const withPayments = { payments: true } as const;

export class LoansService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string, opts: { status: LoanStatus; cursor?: string; limit: number }): Promise<LoanList> {
    const today = todayIST();
    const where: Prisma.LoanWhereInput = { userId };
    if (opts.status === "repaid") where.repaidAt = { not: null };
    if (opts.status === "overdue") {
      where.repaidAt = null;
      where.dueDate = { lt: fromDateString(today) };
    }

    const rows = await this.prisma.loan.findMany({
      where,
      include: withPayments,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      take: opts.limit + 1,
      ...(opts.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
    });

    const page = rows.slice(0, opts.limit);
    return {
      items: page.map((l) => serializeLoan(l, today)),
      nextCursor: rows.length > opts.limit ? page[page.length - 1]!.id : null,
    };
  }

  async get(userId: string, id: string): Promise<Loan> {
    const loan = await this.prisma.loan.findFirst({ where: { id, userId }, include: withPayments });
    if (!loan) throw notFound("Loan not found");
    return serializeLoan(loan, todayIST());
  }

  /** Returns the loan and whether it was newly created (false on an idempotent replay). */
  async create(userId: string, input: CreateLoanInput, idempotencyKey?: string): Promise<{ loan: Loan; created: boolean }> {
    const today = todayIST();

    if (idempotencyKey) {
      const existing = await this.prisma.loan.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
        include: withPayments,
      });
      if (existing) return { loan: serializeLoan(existing, today), created: false };
    }

    try {
      const loan = await this.prisma.loan.create({
        data: {
          userId,
          friendName: input.friendName,
          amountPaise: input.amountPaise,
          dueDate: fromDateString(input.dueDate),
          interestRateBps: input.interestRateBps ?? 0,
          interestPeriod: input.interestPeriod ?? "MONTH",
          idempotencyKey: idempotencyKey ?? null,
        },
        include: withPayments,
      });
      return { loan: serializeLoan(loan, today), created: true };
    } catch (err) {
      // Two identical requests raced past the lookup above; the unique index caught the second.
      if (idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await this.prisma.loan.findUniqueOrThrow({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
          include: withPayments,
        });
        return { loan: serializeLoan(existing, today), created: false };
      }
      throw err;
    }
  }

  /**
   * Records money received. Interest is worked out as of today, the payment clears interest first,
   * and the loan is marked repaid when nothing is left. The loan row is locked for the duration, so
   * two payments at once can't both squeeze past the "no more than is owed" check.
   * Replaying the same Idempotency-Key returns the loan unchanged.
   */
  async addPayment(userId: string, loanId: string, input: CreatePaymentInput, idempotencyKey?: string): Promise<Loan> {
    const today = todayIST();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Loan" WHERE "id" = ${loanId} AND "userId" = ${userId} FOR UPDATE
        `;
        if (locked.length === 0) throw notFound("Loan not found");

        const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId }, include: withPayments });

        if (idempotencyKey && loan.payments.some((p) => p.idempotencyKey === idempotencyKey)) {
          return serializeLoan(loan, today);
        }
        if (loan.repaidAt) {
          if (input.full) return serializeLoan(loan, today); // "pay in full" on a settled loan is a no-op
          throw badRequest("This loan is already fully repaid", "amountPaise");
        }

        const owed = serializeLoan(loan, today).balance.owedPaise;
        const amount = input.full ? owed : input.amountPaise!;
        if (amount <= 0) throw badRequest("Nothing is owed on this loan", "amountPaise");
        if (amount > owed) {
          throw badRequest(`That is more than the ${formatRupees(owed, { alwaysShowPaise: true })} still owed`, "amountPaise");
        }

        await tx.payment.create({
          data: {
            loanId,
            amountPaise: amount,
            paidOn: fromDateString(today),
            note: input.note || null,
            idempotencyKey: idempotencyKey ?? null,
          },
        });

        const updated = await tx.loan.findUniqueOrThrow({ where: { id: loanId }, include: withPayments });
        if (serializeLoan(updated, today).balance.owedPaise === 0) {
          const settled = await tx.loan.update({
            where: { id: loanId },
            data: { repaidAt: new Date() },
            include: withPayments,
          });
          return serializeLoan(settled, today);
        }
        return serializeLoan(updated, today);
      });
    } catch (err) {
      // The same Idempotency-Key arrived twice at once and the unique index stopped the second insert.
      if (idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return this.get(userId, loanId);
      }
      throw err;
    }
  }

  /** Kept for older app builds: "mark repaid" is now "receive everything that is owed". */
  repay(userId: string, id: string): Promise<Loan> {
    return this.addPayment(userId, id, { full: true });
  }

  /**
   * Interest depends on each loan's payment history, so totals are computed with the same shared
   * maths the loan screens use rather than in SQL. A personal ledger is small enough for that.
   */
  async summary(userId: string): Promise<Summary> {
    const today = todayIST();
    const loans = await this.prisma.loan.findMany({ where: { userId }, include: withPayments });

    const s: Summary = {
      totalLentPaise: 0,
      totalRepaidPaise: 0,
      interestEarnedPaise: 0,
      outstandingPaise: 0,
      interestDuePaise: 0,
      overduePaise: 0,
      overdueCount: 0,
    };
    for (const loan of loans) {
      const l = serializeLoan(loan, today);
      s.totalLentPaise += l.amountPaise;
      s.totalRepaidPaise += l.balance.principalPaidPaise;
      s.interestEarnedPaise += l.balance.interestPaidPaise;
      s.outstandingPaise += l.balance.owedPaise;
      s.interestDuePaise += l.balance.interestDuePaise;
      if (l.overdue) {
        s.overduePaise += l.balance.owedPaise;
        s.overdueCount += 1;
      }
    }
    return s;
  }
}
