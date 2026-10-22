import { todayIST, type CreateLoanInput, type Loan, type LoanList, type LoanStatus, type Summary } from "@miniledger/shared";
import { Prisma, type PrismaClient } from "@prisma/client";
import { notFound } from "../../lib/errors";
import { fromDateString, serializeLoan } from "../../lib/serialize";

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

  /** Returns the loan and whether it was newly created (false on an idempotent replay). */
  async create(userId: string, input: CreateLoanInput, idempotencyKey?: string): Promise<{ loan: Loan; created: boolean }> {
    const today = todayIST();

    if (idempotencyKey) {
      const existing = await this.prisma.loan.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
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
          idempotencyKey: idempotencyKey ?? null,
        },
      });
      return { loan: serializeLoan(loan, today), created: true };
    } catch (err) {
      // Two identical requests raced past the lookup above; the unique index caught the second.
      if (idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await this.prisma.loan.findUniqueOrThrow({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
        });
        return { loan: serializeLoan(existing, today), created: false };
      }
      throw err;
    }
  }

  /** Idempotent: repaying an already repaid loan returns it unchanged. */
  async repay(userId: string, id: string): Promise<Loan> {
    await this.prisma.loan.updateMany({
      where: { id, userId, repaidAt: null },
      data: { repaidAt: new Date() },
    });
    const loan = await this.prisma.loan.findFirst({ where: { id, userId } });
    if (!loan) throw notFound("Loan not found");
    return serializeLoan(loan, todayIST());
  }

  /** One SQL aggregate, not a loop in JS. SUM returns bigint in Postgres, hence the Number() casts. */
  async summary(userId: string): Promise<Summary> {
    const today = todayIST();
    const [row] = await this.prisma.$queryRaw<
      { lent: bigint; repaid: bigint; overdue: bigint; overdue_count: bigint }[]
    >`
      SELECT
        COALESCE(SUM("amountPaise"), 0) AS lent,
        COALESCE(SUM("amountPaise") FILTER (WHERE "repaidAt" IS NOT NULL), 0) AS repaid,
        COALESCE(SUM("amountPaise") FILTER (WHERE "repaidAt" IS NULL AND "dueDate" < ${today}::date), 0) AS overdue,
        COUNT(*) FILTER (WHERE "repaidAt" IS NULL AND "dueDate" < ${today}::date) AS overdue_count
      FROM "Loan"
      WHERE "userId" = ${userId}
    `;
    return {
      totalLentPaise: Number(row?.lent ?? 0),
      totalRepaidPaise: Number(row?.repaid ?? 0),
      overduePaise: Number(row?.overdue ?? 0),
      overdueCount: Number(row?.overdue_count ?? 0),
    };
  }
}
