import { z } from "zod";
import { isValidDateString, todayIST } from "./dates";

// Prisma Int is a 32-bit signed integer (max 2,147,483,647 paise ≈ ₹2.14 crore).
export const MAX_LOAN_PAISE = 2_000_000_000;

export const phoneSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const otpRequestSchema = z.object({ phone: phoneSchema });
export const otpVerifySchema = z.object({
  phone: phoneSchema,
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const tokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});
export const accessTokenResponseSchema = tokenResponseSchema.pick({ accessToken: true, expiresIn: true });

export const dateStringSchema = z
  .string()
  .refine(isValidDateString, "Enter a valid date (YYYY-MM-DD)");

export const interestPeriodSchema = z.enum(["MONTH", "YEAR"]);

/** 100% per period is the ceiling; it only guards against a mistyped rate. */
export const MAX_RATE_BPS = 10_000;

export const interestRateBpsSchema = z
  .number({ invalid_type_error: "Enter a rate" })
  .int("Rate can have at most 2 decimals")
  .min(0, "Rate can't be negative")
  .max(MAX_RATE_BPS, "Rate can't be more than 100%");

export const createLoanSchema = z.object({
  friendName: z.string().trim().min(1, "Friend's name is required").max(60, "Name is too long"),
  amountPaise: z
    .number({ invalid_type_error: "Enter an amount" })
    .int("Amount must be in whole paise")
    .min(100, "Minimum amount is ₹1")
    .max(MAX_LOAN_PAISE, "Amount is too large"),
  dueDate: dateStringSchema.refine((d) => d >= todayIST(), "Due date can't be in the past"),
  /** Optional simple interest: hundredths of a percent per period (200 = 2%). Omitted or 0 = interest-free. */
  interestRateBps: interestRateBpsSchema.optional(),
  interestPeriod: interestPeriodSchema.optional(),
});
export type CreateLoanInput = z.infer<typeof createLoanSchema>;

export const loanStatusSchema = z.enum(["all", "overdue", "repaid"]);
export type LoanStatus = z.infer<typeof loanStatusSchema>;

export const listLoansQuerySchema = z.object({
  status: loanStatusSchema.default("all"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const paymentSchema = z.object({
  id: z.string(),
  amountPaise: z.number().int(),
  paidOn: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type Payment = z.infer<typeof paymentSchema>;

/** Either an exact amount, or `full: true` to clear whatever is owed at the moment the server handles it. */
export const createPaymentSchema = z
  .object({
    amountPaise: z
      .number({ invalid_type_error: "Enter an amount" })
      .int("Amount must be in whole paise")
      .min(100, "Minimum payment is ₹1")
      .max(MAX_LOAN_PAISE, "Amount is too large")
      .optional(),
    full: z.boolean().optional(),
    note: z.string().trim().max(120, "Note is too long").optional(),
  })
  .refine((v) => v.full === true || v.amountPaise !== undefined, {
    message: "Enter an amount",
    path: ["amountPaise"],
  });
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const balanceSchema = z.object({
  paidPaise: z.number().int(),
  principalPaidPaise: z.number().int(),
  interestPaidPaise: z.number().int(),
  principalDuePaise: z.number().int(),
  interestDuePaise: z.number().int(),
  owedPaise: z.number().int(),
});

export const loanSchema = z.object({
  id: z.string(),
  friendName: z.string(),
  /** The amount originally lent (principal). */
  amountPaise: z.number().int(),
  dueDate: z.string(),
  lentOn: z.string(),
  repaidAt: z.string().nullable(),
  createdAt: z.string(),
  overdue: z.boolean(),
  daysOverdue: z.number().int(),
  interestRateBps: z.number().int(),
  interestPeriod: interestPeriodSchema,
  payments: z.array(paymentSchema),
  /** Computed as of today (IST), or as of the repaid date once settled. */
  balance: balanceSchema,
});
export type Loan = z.infer<typeof loanSchema>;

export const loanListSchema = z.object({
  items: z.array(loanSchema),
  nextCursor: z.string().nullable(),
});
export type LoanList = z.infer<typeof loanListSchema>;

export const summarySchema = z.object({
  totalLentPaise: z.number().int(),
  /** Principal received back so far. */
  totalRepaidPaise: z.number().int(),
  /** Interest actually received so far. */
  interestEarnedPaise: z.number().int(),
  /** Everything still owed to you right now: unpaid principal + unpaid interest. */
  outstandingPaise: z.number().int(),
  /** Of that, the interest part. */
  interestDuePaise: z.number().int(),
  /** Owed on loans past their due date. */
  overduePaise: z.number().int(),
  overdueCount: z.number().int(),
});
export type Summary = z.infer<typeof summarySchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    description: z.string(),
    field: z.string().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
