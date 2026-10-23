import type { Loan, LoanStatus } from "@miniledger/shared";
import { onlineManager, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { api } from "../../lib/api";
import type { AddLoanVars, AddPaymentVars } from "../../lib/query";
import { loanKey, loansKey, summaryKey, type LoanPages } from "./cache";

export function useIsOnline() {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

export function useLoans(status: LoanStatus) {
  return useInfiniteQuery({
    queryKey: loansKey(status),
    queryFn: ({ pageParam }) => api.listLoans({ status, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: (data: LoanPages) => data.pages.flatMap((p) => p.items),
  });
}

/**
 * One loan for the detail screen. It is read from the list already on screen (so it updates with
 * every optimistic change) and only fetched on its own if it isn't in the pages loaded so far.
 */
export function useLoan(id: string): { loan: Loan | undefined; loading: boolean; error: Error | null } {
  const all = useLoans("all");
  const fromList = all.data?.find((l) => l.id === id);
  const single = useQuery({ queryKey: loanKey(id), queryFn: () => api.getLoan(id), enabled: !fromList && !all.isPending });
  return {
    loan: fromList ?? single.data,
    loading: all.isPending || (!fromList && single.isPending),
    error: single.error,
  };
}

export function useSummary() {
  return useQuery({ queryKey: summaryKey, queryFn: api.summary });
}

// mutationFn and optimistic logic come from the defaults registered in lib/query.ts.
export const useAddLoan = () => useMutation<unknown, Error, AddLoanVars>({ mutationKey: ["addLoan"] });
export const useAddPayment = () => useMutation<unknown, Error, AddPaymentVars>({ mutationKey: ["addPayment"] });

/** Good-enough unique id for idempotency keys; uniqueness matters here, not secrecy. */
export function newIdempotencyKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
