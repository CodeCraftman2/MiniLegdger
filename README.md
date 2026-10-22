# MiniLedger

Track money you've lent to friends. Android-first React Native app + a Fastify/Postgres API, in one pnpm monorepo.

| | |
|---|---|
| Live API | _add your Render URL here_ (`/docs` for Swagger, `/health` for uptime) |
| Android APK | _add your EAS / GitHub release link here_ |
| Demo | _add a GIF here_ |

> **Cold starts:** on Render's free tier the API sleeps after ~15 minutes without traffic. The first request after that can take 30–60 s. The app shows its normal loading skeleton while it waits.

## What's in the box

```
apps/api         Fastify 5 + TypeScript + Prisma + PostgreSQL
apps/mobile      Expo (React Native) + Expo Router + TanStack Query
packages/shared  Zod schemas, money + date helpers used by BOTH of the above
docs/            API.md, DEPLOYMENT.md, TROUBLESHOOTING.md
```

The shared package is the point of the layout: the same Zod schema that validates a loan in the API validates the form in the app, so the two can't drift apart. Money formatting (`₹1,23,456`) and the "what counts as overdue" rule live there too.

## 2-minute setup

Prerequisites: Node 22+, pnpm 9 (`corepack enable`), Docker.

```bash
pnpm install

# 1. Postgres + API in Docker (migrations run on start)
docker compose up --build
#    API: http://localhost:3000   Swagger: http://localhost:3000/docs

# 2. ...or run the API on your machine against only the Docker database
docker compose up db -d
cp apps/api/.env.example apps/api/.env
pnpm --filter @miniledger/api exec prisma migrate deploy
pnpm dev

# 3. The app
cp apps/mobile/.env.example apps/mobile/.env   # EXPO_PUBLIC_API_URL
pnpm dev:mobile                                # press "a" for the Android emulator
```

Sign-in uses a **mock SMS provider**: when you tap "Send OTP", the 6-digit code is printed in the API server log (`[mock SMS] OTP generated`). On the Android emulator the host machine is `10.0.2.2`; on a real phone use your computer's LAN IP in `EXPO_PUBLIC_API_URL`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | API with hot reload |
| `pnpm dev:mobile` | Expo dev server |
| `pnpm test` | Vitest (API tests need `DATABASE_URL` pointing at a throwaway Postgres) |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm lint` | ESLint |

## Rules worth knowing

- **Money is an integer number of paise.** Never a float. `₹` formatting happens only at the screen edge, with Indian digit grouping.
- **Overdue** = not repaid **and** `dueDate` is strictly before today in `Asia/Kolkata`. A loan due *today* is not overdue.
- **Due dates are plain dates** (`YYYY-MM-DD`, a Postgres `DATE`), so a UTC conversion can never shift one by a day.
- **One error shape everywhere:** `{ "error": { "code", "description", "field?" } }`, so the app can attach messages to form fields.
- **Writes are retry-safe.** `POST /v1/loans` takes an `Idempotency-Key`; `PATCH /v1/loans/:id/repay` is naturally idempotent.

## Offline behaviour (mobile)

- The TanStack Query cache is persisted to AsyncStorage, so the list opens with saved data and an "You're offline – showing saved data" banner.
- Adding an entry or marking one repaid while offline queues the action. New entries show instantly with a "Waiting to sync" badge. Queued actions are sent when the connection returns and after an app restart; the idempotency key is stored with the action so a replay can't create a duplicate.
- "Mark repaid" is optimistic and is rolled back if the server rejects it.

## Tests & CI

API tests use Fastify's `app.inject()` against a real Postgres (no mocked database). They cover: summary math, the overdue boundary, OTP expiry and attempt lockout, repaying twice, one user not seeing another's loans, idempotent creates (including a concurrent race), and pagination.

GitHub Actions (`.github/workflows/ci.yml`) runs on every push: install → lint → typecheck → Postgres service container → `prisma migrate deploy` → Vitest. `android-apk.yml` is a manual workflow that builds an APK on EAS.

## Trade-offs (what I skipped, and why)

- **OTP is mocked** behind an `SmsProvider` interface (`apps/api/src/lib/sms.ts`). A real provider (MSG91, Twilio, SNS) is one class implementing `sendOtp` and a one-line change in `app.ts`. The mock logs the code, so **don't run it in production with real users**.
- **Refresh tokens are stateless JWTs** (30 days). There's no server-side revocation or rotation; signing out only clears the device. A `RefreshToken` table with rotation is the next step.
- **Idempotency keys are not compared with the request body.** Re-using a key with a *different* payload returns the original loan instead of an error.
- **Single currency (INR)**, single phone region (+91), no editing or deleting entries, no push reminders.
- **Free-tier hosting** means cold starts and no horizontal scaling. See [DEPLOYMENT.md](docs/DEPLOYMENT.md).
- **Not run on a physical iOS device**; the app is Android-first. iOS code paths (inline date picker) exist but are untested.
- **Docs:** [API.md](docs/API.md) · [DEPLOYMENT.md](docs/DEPLOYMENT.md) · [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
