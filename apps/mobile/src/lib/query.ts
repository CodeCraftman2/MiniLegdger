import { isOverdue, todayIST, type CreateLoanInput, type Loan } from "@miniledger/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import {
  PENDING_PREFIX,
  findLoan,
  mapLoanLists,
  patchSummary,
  restore,
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
export type RepayLoanVars = { id: string };

const retryNetworkOnly = (count: number, err: unknown) => err instanceof ApiError && err.isNetwork && count < 3;

const invalidateLedger = () => {
  void queryClient.invalidateQueries({ queryKey: ["loans"] });
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
    const temp: Loan = {
      id: `${PENDING_PREFIX}${idempotencyKey}`,
      friendName: input.friendName,
      amountPaise: input.amountPaise,
      dueDate: input.dueDate,
      repaidAt: null,
      createdAt: new Date().toISOString(),
      overdue: isOverdue(input.dueDate, null, today),
      daysOverdue: 0,
    };
    mapLoanLists(queryClient, (items, status, page) => (status === "all" && page === 0 ? [temp, ...items] : items));
    patchSummary(queryClient, (s) => ({ ...s, totalLentPaise: s.totalLentPaise + input.amountPaise }));
    return { snapshot };
  },
  onError: (_e, _v, ctx) => restore(queryClient, (ctx as { snapshot?: Parameters<typeof restore>[1] } | undefined)?.snapshot),
  onSettled: invalidateLedger,
});

queryClient.setMutationDefaults(["repayLoan"], {
  mutationFn: ({ id }: RepayLoanVars) => api.repay(id),
  retry: retryNetworkOnly,
  onMutate: async ({ id }: RepayLoanVars) => {
    const snapshot = await snapshotAndCancel(queryClient);
    const loan = findLoan(queryClient, id);
    const today = todayIST();
    mapLoanLists(queryClient, (items, status) => {
      if (status === "overdue") return items.filter((l) => l.id !== id);
      return items.map((l) =>
        l.id === id ? { ...l, repaidAt: new Date().toISOString(), overdue: false, daysOverdue: 0 } : l,
      );
    });
    if (loan && !loan.repaidAt) {
      const wasOverdue = isOverdue(loan.dueDate, null, today);
      patchSummary(queryClient, (s) => ({
        ...s,
        totalRepaidPaise: s.totalRepaidPaise + loan.amountPaise,
        overduePaise: wasOverdue ? s.overduePaise - loan.amountPaise : s.overduePaise,
        overdueCount: wasOverdue ? s.overdueCount - 1 : s.overdueCount,
      }));
    }
    return { snapshot };
  },
  onError: (_e, _v, ctx) => restore(queryClient, (ctx as { snapshot?: Parameters<typeof restore>[1] } | undefined)?.snapshot),
  onSettled: invalidateLedger,
});

