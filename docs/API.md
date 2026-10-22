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
  "id": "cm...", "friendName": "Asha", "amountPaise": 150000,
  "dueDate": "2025-03-14", "repaidAt": null, "createdAt": "2025-03-01T10:00:00.000Z",
  "overdue": false, "daysOverdue": 0
}
```

### `GET /v1/loans?status=all|overdue|repaid&cursor=&limit=`
Ordered by due date, then id. `limit` is 1–50 (default 20). Returns `{ "items": [...], "nextCursor": "id" | null }`; pass `nextCursor` back as `cursor`.

### `POST /v1/loans`
```json
{ "friendName": "Asha", "amountPaise": 150000, "dueDate": "2025-03-14" }
```
Rules: name 1–60 chars; `amountPaise` an integer from 100 (₹1) up to 2,000,000,000; `dueDate` a real date, today or later (IST).
Send an **`Idempotency-Key`** header (≤128 chars). Replaying the same key returns the original loan with `200` instead of `201`, including when two identical requests arrive at the same moment.

### `PATCH /v1/loans/:id/repay`
Marks the loan repaid and returns it. Calling it again is a no-op that returns the same `repaidAt`. `404` if the loan isn't yours.

### `GET /v1/loans/summary`
```json
{ "totalLentPaise": 80050, "totalRepaidPaise": 40000, "overduePaise": 30050, "overdueCount": 2 }
```
Computed with a single SQL aggregate (`SUM ... FILTER (WHERE ...)`).

## Health

`GET /health` → `200 {"status":"ok"}` when the database answers `SELECT 1`, otherwise `503`. Not rate limited, so uptime pingers and Docker healthchecks are safe.
