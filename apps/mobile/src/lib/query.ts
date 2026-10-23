import {
  isOverdue,
  loanBalance,
  todayIST,
  withPayment,
  type CreateLoanInput,
  type CreatePaymentInput,
  type Loan,
} from "@miniledger/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import {
  PENDING_PREFIX,
  findLoan,
  mapLoanLists,
  patchSummary,
  replaceLoan,
  restore,
  shiftSummary,
  snapshotAndCancel,
} from "../features/loans/cache";
import { ApiError, api } from "./api";

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 7 * DAY, // must be >= the persister maxAge or restored data is discarded
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "miniledger.cache.v1" });
export const PERSIST_MAX_AGE = 7 * DAY;

// Tell TanStack Query when the device is offline so mutations pause (and queue) instead of failing.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false)),
);

export type AddLoanVars = { input: CreateLoanInput; idempotencyKey: string };
export type AddPaymentVars = { loanId: string; input: CreatePaymentInput; idempotencyKey: string };

const retryNetworkOnly = (count: number, err: unknown) => err instanceof ApiError && err.isNetwork && count < 3;

const invalidateLedger = () => {
  void queryClient.invalidateQueries({ queryKey: ["loans"] });
  void queryClient.invalidateQueries({ queryKey: ["loan"] });
  void queryClient.invalidateQueries({ queryKey: ["summary"] });
};

/**
 * Mutation defaults live here (not inside hooks) so paused mutations restored from disk after an
 * app restart know how to run. The idempotency key is part of the variables, so it is persisted
 * too and a replay after reconnecting can never create a duplicate.
 */
queryClient.setMutationDefaults(["addLoan"], {
  mutationFn: ({ input, idempotencyKey }: AddLoanVars) => api.createLoan(input, idempotencyKey),
  retry: retryNetworkOnly,
  onMutate: async ({ input, idempotencyKey }: AddLoanVars) => {
    const snapshot = await snapshotAndCancel(queryClient);
    const today = todayIST();
    const base = {
      amountPaise: input.amountPaise,
      lentOn: today,
      interestRateBps: input.interestRateBps ?? 0,
      interestPeriod: input.interestPeriod ?? ("MONTH" as const),
      payments: [],
      repaidAt: null,
    };
    const temp: Loan = {
      ...base,
      id: `${PENDING_PREFIX}${idempotencyKey}`,
      friendName: input.friendName,
      dueDate: input.dueDate,
      createdAt: new Date().toISOString(),
      overdue: isOverdue(input.dueDate, null, today),
      daysOverdue: 0,
      balance: loanBalance(base, today),
    };
    mapLoanLists(queryClient, (items, status, page) => (status === "all" && page === 0 ? [temp, ...items] : items));
    patchSummary(queryClient, (s) => ({
      ...s,
      totalLentPaise: s.totalLentPaise + input.amountPaise,
      outstandingPaise: s.outstandingPaise + input.amountPaise,
    }));
    return { snapshot };
  },
  onError: (_e, _v, ctx) => restore(queryClient, (ctx as { snapshot?: Parameters<typeof restore>[1] } | undefined)?.snapshot),
  onSettled: invalidateLedger,
});

queryClient.setMutationDefaults(["addPayment"], {
  mutationFn: ({ loanId, input, idempotencyKey }: AddPaymentVars) => api.addPayment(loanId, input, idempotencyKey),
  retry: retryNetworkOnly,
  onMutate: async ({ loanId, input, idempotencyKey }: AddPaymentVars) => {
    const snapshot = await snapshotAndCancel(queryClient);
    const before = findLoan(queryClient, loanId);
    if (before && !before.repaidAt) {
      const today = todayIST();
      const amountPaise = input.full ? before.balance.owedPaise : Math.min(input.amountPaise ?? 0, before.balance.owedPaise);
      const after = withPayment(
        before,
        {
          id: `${PENDING_PREFIX}${idempotencyKey}`,
          amountPaise,
          paidOn: today,
          note: input.note ?? null,
          createdAt: new Date().toISOString(),
        },
        today,
      );
      replaceLoan(queryClient, after);
      shiftSummary(queryClient, before, after);
    }
    return { snapshot };
  },
  onError: (_e, _v, ctx) => restore(queryClient, (ctx as { snapshot?: Parameters<typeof restore>[1] } | undefined)?.snapshot),
  onSettled: invalidateLedger,
});
