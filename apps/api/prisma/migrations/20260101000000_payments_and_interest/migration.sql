-- CreateEnum
CREATE TYPE "InterestPeriod" AS ENUM ('MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "interestPeriod" "InterestPeriod" NOT NULL DEFAULT 'MONTH',
ADD COLUMN     "interestRateBps" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "paidOn" DATE NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_loanId_paidOn_idx" ON "Payment"("loanId", "paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_loanId_idempotencyKey_key" ON "Payment"("loanId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Loans already marked repaid become one payment for the full amount, so history and totals stay correct.
INSERT INTO "Payment" ("id", "loanId", "amountPaise", "paidOn", "createdAt")
SELECT 'backfill_' || "id", "id", "amountPaise", ("repaidAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date, "repaidAt"
FROM "Loan"
WHERE "repaidAt" IS NOT NULL;
