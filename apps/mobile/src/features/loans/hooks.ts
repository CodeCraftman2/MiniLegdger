import type { LoanStatus } from "@miniledger/shared";
import { onlineManager, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { api } from "../../lib/api";
import type { AddLoanVars, RepayLoanVars } from "../../lib/query";
import { loansKey, summaryKey, type LoanPages } from "./cache";

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

export function useSummary() {
  return useQuery({ queryKey: summaryKey, queryFn: api.summary });
}

// mutationFn and optimistic logic come from the defaults registered in lib/query.ts.
export const useAddLoan = () => useMutation<unknown, Error, AddLoanVars>({ mutationKey: ["addLoan"] });
export const useRepayLoan = () => useMutation<unknown, Error, RepayLoanVars>({ mutationKey: ["repayLoan"] });

/** Good-enough unique id for idempotency keys; uniqueness matters here, not secrecy. */
export function newIdempotencyKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
