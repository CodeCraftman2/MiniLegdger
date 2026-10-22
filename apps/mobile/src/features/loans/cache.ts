import type { Loan, LoanList, LoanStatus, Summary } from "@miniledger/shared";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

export type LoanPages = InfiniteData<LoanList, string | undefined>;
export const STATUSES: LoanStatus[] = ["all", "overdue", "repaid"];
export const PENDING_PREFIX = "pending-";

export const loansKey = (status: LoanStatus) => ["loans", status] as const;
export const summaryKey = ["summary"] as const;

export const isPendingSync = (loan: Loan) => loan.id.startsWith(PENDING_PREFIX);

type Snapshot = { key: readonly unknown[]; data: unknown }[];

/** Cancels in-flight fetches (so they can't overwrite the optimistic state) and remembers the old cache. */
export async function snapshotAndCancel(qc: QueryClient): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: ["loans"] });
  await qc.cancelQueries({ queryKey: summaryKey });
  return [...qc.getQueriesData({ queryKey: ["loans"] }), ...qc.getQueriesData({ queryKey: summaryKey })].map(
    ([key, data]) => ({ key, data }),
  );
}

export function restore(qc: QueryClient, snapshot: Snapshot | undefined) {
  snapshot?.forEach(({ key, data }) => qc.setQueryData(key, data));
}

export function findLoan(qc: QueryClient, id: string): Loan | undefined {
  for (const [, data] of qc.getQueriesData<LoanPages>({ queryKey: ["loans"] })) {
    for (const page of data?.pages ?? []) {
      const hit = page.items.find((l) => l.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

export function mapLoanLists(
  qc: QueryClient,
  fn: (items: Loan[], status: LoanStatus, pageIndex: number) => Loan[],
) {
  for (const status of STATUSES) {
    qc.setQueryData<LoanPages>(loansKey(status), (old) =>
      old ? { ...old, pages: old.pages.map((p, i) => ({ ...p, items: fn(p.items, status, i) })) } : old,
    );
  }
}

export function patchSummary(qc: QueryClient, fn: (s: Summary) => Summary) {
  qc.setQueryData<Summary>(summaryKey, (old) => (old ? fn(old) : old));
}
