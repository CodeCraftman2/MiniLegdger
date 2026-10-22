import {
  accessTokenResponseSchema,
  loanListSchema,
  loanSchema,
  summarySchema,
  tokenResponseSchema,
  type CreateLoanInput,
  type LoanStatus,
} from "@miniledger/shared";
import { z } from "zod";
import { tokenStore } from "./token-store";

const otpRequestedSchema = z.object({ expiresInSeconds: z.number() });

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000").replace(/\/$/, "");

/** status 0 means the request never reached the server (offline, DNS, timeout). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

let onSessionExpired: () => void = () => undefined;
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

const REQUEST_TIMEOUT_MS = 20_000;

async function rawFetch(path: string, init: RequestInit & { token?: string | null }): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection.");
  } finally {
    clearTimeout(timer);
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    const e = body?.error;
    return new ApiError(res.status, e?.code ?? "UNKNOWN", e?.description ?? "Something went wrong", e?.field);
  } catch {
    return new ApiError(res.status, "UNKNOWN", "Something went wrong");
  }
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, even if several requests hit a 401 together. */
function refreshAccessToken(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = await tokenStore.getRefresh();
    if (!refreshToken) return false;
    const res = await rawFetch("/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) });
    if (!res.ok) return false;
    const parsed = accessTokenResponseSchema.parse(await res.json());
    tokenStore.setAccess(parsed.accessToken);
    return true;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function request<S extends z.ZodTypeAny>(
  schema: S,
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string>; auth?: boolean } = {},
): Promise<z.infer<S>> {
  const { method = "GET", body, headers, auth = true } = opts;
  const send = () =>
    rawFetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      token: auth ? tokenStore.getAccess() : null,
    });

  let res = await send();
  if (res.status === 401 && auth) {
    const refreshed = await refreshAccessToken().catch(() => false);
    if (!refreshed) {
      onSessionExpired();
      throw await toApiError(res);
    }
    res = await send();
  }
  if (!res.ok) throw await toApiError(res);
  return schema.parse(await res.json());
}

export const api = {
  requestOtp: (phone: string) =>
    request(otpRequestedSchema, "/v1/auth/otp/request", { method: "POST", body: { phone }, auth: false }),
  verifyOtp: (phone: string, otp: string) =>
    request(tokenResponseSchema, "/v1/auth/otp/verify", { method: "POST", body: { phone, otp }, auth: false }),

  listLoans: (p: { status: LoanStatus; cursor?: string }) => {
    const qs = new URLSearchParams({ status: p.status });
    if (p.cursor) qs.set("cursor", p.cursor);
    return request(loanListSchema, `/v1/loans?${qs}`);
  },
  summary: () => request(summarySchema, "/v1/loans/summary"),
  createLoan: (input: CreateLoanInput, idempotencyKey: string) =>
    request(loanSchema, "/v1/loans", {
      method: "POST",
      body: input,
      headers: { "idempotency-key": idempotencyKey },
    }),
  repay: (id: string) => request(loanSchema, `/v1/loans/${encodeURIComponent(id)}/repay`, { method: "PATCH" }),
};
