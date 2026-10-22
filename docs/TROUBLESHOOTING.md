# Troubleshooting

## API

**`Invalid environment configuration: - JWT_SECRET: ...` on start**
A required variable is missing or too short. Copy `apps/api/.env.example` to `apps/api/.env` and fill it in. `JWT_SECRET` needs at least 32 characters.

**`Can't reach database server` / Prisma `P1001`**
Postgres isn't running or `DATABASE_URL` is wrong. With Docker: `docker compose up db -d`, then use `localhost:5432`. Inside Compose the host is `db`, not `localhost`. On Neon keep `?sslmode=require`.

**`The table public.Loan does not exist`**
Migrations haven't run: `pnpm --filter @miniledger/api exec prisma migrate deploy`.

**Tests fail with `DATABASE_URL must be set`**
The tests use a real Postgres. Point `DATABASE_URL` at a throwaway database (the Compose `db` service works) and run `prisma migrate deploy` once first.

**Where is the OTP?**
Mock SMS: look in the API server output for `[mock SMS] OTP generated` with an `otp` field. In Docker: `docker compose logs -f api`.

**429 `TOO_MANY_REQUESTS` on OTP request**
Max 3 OTP requests per phone per 10 minutes. Wait, or use another number locally.

**First request to the deployed API takes ~a minute**
Free Render instances sleep when idle. Hit `/health` to wake it, or add an uptime pinger.

## Mobile

**App shows "Can't reach the server" on the Android emulator**
`localhost` inside the emulator is the emulator itself. Use `http://10.0.2.2:3000` (the default). On a physical phone use your computer's LAN IP (same Wi-Fi) and allow port 3000 through the firewall. Restart Expo after changing `.env` (`EXPO_PUBLIC_*` values are inlined at build time): `pnpm dev:mobile -- --clear`.

**"Unable to resolve module @miniledger/shared"**
Install from the repo root (`pnpm install`), not inside `apps/mobile`. The repo sets `node-linker=hoisted` in `.npmrc` because Metro needs a flat `node_modules`.

**Stale list after switching accounts**
Signing out clears the query cache. If you see old data after wiping the API database, clear the app's storage (Android: Settings → Apps → MiniLedger → Storage → Clear).

**An offline entry is stuck on "Waiting to sync"**
It is sent when the device is online *and* the server is reachable. Pull to refresh or reopen the app. If the server rejects it (for example the due date has since passed), the entry disappears on the next refresh and the form data is not kept.

## CI

**`prisma generate` / type errors about `@prisma/client`**
CI runs `prisma generate` before typecheck. Locally run `pnpm --filter @miniledger/api exec prisma generate` after pulling schema changes.
