# API reference

Interactive docs (generated from the Zod schemas) are served at **`/docs`**. This page covers the conventions.

Base path: `/v1`. All bodies are JSON. Authenticated routes need `Authorization: Bearer <accessToken>`.

## Errors

Every failure has the same shape:

```json
{ "error": { "code": "BAD_REQUEST_ERROR", "description": "Due date can't be in the past", "field": "dueDate" } }
```

| `code` | HTTP | Meaning |
|---|---|---|
| `BAD_REQUEST_ERROR` | 400 | Validation failed or the OTP is wrong/expired. `field` names the offending input when there is one. |
| `AUTHENTICATION_ERROR` | 401 | Missing, invalid or expired token. |
| `NOT_FOUND_ERROR` | 404 | Unknown route, or a loan that isn't yours (indistinguishable on purpose). |
| `TOO_MANY_REQUESTS` | 429 | Rate limit hit, OTP request cap, or OTP attempt lockout. |
| `SERVER_ERROR` | 500 | Unexpected; details are in the server log only. |

## Auth

### `POST /v1/auth/otp/request`
```json
{ "phone": "+919773331399" }
```
→ `200 { "expiresInSeconds": 300 }`. The code is printed to the server log (mock SMS). Limits: 3 requests per phone per 10 minutes, plus a per-IP rate limit.

### `POST /v1/auth/otp/verify`
```json
{ "phone": "+919773331399", "otp": "123456" }
```
→ `200 { "accessToken", "refreshToken", "expiresIn": 900 }`.
The OTP expires after 5 minutes, locks after 5 wrong attempts (even the right code is then refused) and can be used once. Only an HMAC of the code is stored.

### `POST /v1/auth/refresh`
```json
{ "refreshToken": "..." }
```
→ `200 { "accessToken", "expiresIn" }`. Access tokens last 15 minutes, refresh tokens 30 days. Each token type is rejected where the other is expected.

## Loans

A loan looks like:

```json
{
  "id": "cm...", "friendName": "Asha", "amountPaise": 100000,
  "dueDate": "2025-03-14", "lentOn": "2025-03-01", "repaidAt": null, "createdAt": "2025-03-01T10:00:00.000Z",
  "overdue": false, "daysOverdue": 0,
  "interestRateBps": 200, "interestPeriod": "MONTH",
  "payments": [{ "id": "cm...", "amountPaise": 10000, "paidOn": "2025-03-05", "note": null, "createdAt": "..." }],
  "balance": {
    "paidPaise": 10000, "principalPaidPaise": 10000, "interestPaidPaise": 0,
    "principalDuePaise": 90000, "interestDuePaise": 1200, "owedPaise": 91200
  }
}
```

`amountPaise` is what was lent. `balance` is computed as of today (IST), or frozen at the repaid date once the loan is settled.

**Interest rules.** Simple interest on the principal still outstanding. `interestRateBps` is hundredths of a percent per period (200 = 2%); a month counts as 30 days and a year as 365. Each payment clears accrued interest first, then reduces the principal. A rate of 0 means interest-free.

### `GET /v1/loans?status=all|overdue|repaid&cursor=&limit=`
Ordered by due date, then id. `limit` is 1–50 (default 20). Returns `{ "items": [...], "nextCursor": "id" | null }`; pass `nextCursor` back as `cursor`.

### `GET /v1/loans/:id`
One loan with its payments and balance. `404` if it isn't yours.

### `POST /v1/loans`
```json
{ "friendName": "Asha", "amountPaise": 100000, "dueDate": "2025-03-14", "interestRateBps": 200, "interestPeriod": "MONTH" }
```
Rules: name 1–60 chars; `amountPaise` an integer from 100 (₹1) up to 2,000,000,000; `dueDate` a real date, today or later (IST). `interestRateBps` (0–10000) and `interestPeriod` (`MONTH` or `YEAR`) are optional.
Send an **`Idempotency-Key`** header (≤128 chars). Replaying the same key returns the original loan with `200` instead of `201`, including when two identical requests arrive at the same moment.

### `POST /v1/loans/:id/payments`
Record money received.
```json
{ "amountPaise": 10000, "note": "UPI" }
```
Or `{ "full": true }` to receive everything owed at the moment the server handles the request (interest keeps growing daily, so the exact amount is worked out server-side). Returns the updated loan, which gets `repaidAt` once nothing is left.
`400` with `field: "amountPaise"` if the amount is more than is owed or the loan is already repaid. The loan row is locked while a payment is recorded, so two simultaneous payments can't overpay it. Supports an **`Idempotency-Key`** header: replaying a key never records a second payment.

### `PATCH /v1/loans/:id/repay`
Kept for older app builds. Same as `{ "full": true }` above; calling it again is a no-op. `404` if the loan isn't yours.

### `GET /v1/loans/summary`
```json
{
  "totalLentPaise": 80050, "totalRepaidPaise": 40000, "interestEarnedPaise": 1200,
  "outstandingPaise": 41250, "interestDuePaise": 800, "overduePaise": 30050, "overdueCount": 2
}
```
`totalRepaidPaise` is principal received back, `interestEarnedPaise` is interest actually received, `outstandingPaise` is everything still owed (unpaid principal plus unpaid interest), and `overduePaise` is what is owed on loans past their due date. Computed in code from each loan and its payments, because interest depends on payment dates.

## Health

`GET /health` → `200 {"status":"ok"}` when the database answers `SELECT 1`, otherwise `503`. Not rate limited, so uptime pingers and Docker healthchecks are safe.
