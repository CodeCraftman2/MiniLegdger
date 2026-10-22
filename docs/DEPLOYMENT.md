# Deployment

Free-tier limits change often. Check each provider's current terms before relying on them.

| Piece | Option | Notes |
|---|---|---|
| Database | [Neon](https://neon.tech) | Free Postgres, no card. Use the **pooled** connection string and keep `?sslmode=require`. |
| API | [Render](https://render.com) Docker web service | Free instances sleep after ~15 min idle (cold start). |
| Android build | Expo EAS Build free tier, or local Gradle | Produces the shareable APK. |
| CI | GitHub Actions | Free for public repos. |
| Monitoring | Pino logs in Render + a free uptime pinger on `/health` | The pinger also keeps the free instance warm. |

## Environment variables (API)

See [`apps/api/.env.example`](../apps/api/.env.example). They are validated with Zod at startup; a missing or invalid one stops the process with a readable list.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | | Postgres connection string |
| `JWT_SECRET` | yes | | ≥32 chars, e.g. `openssl rand -hex 32`. Rotating it signs everyone out. It also keys the OTP HMAC. |
| `PORT` / `HOST` | no | `3000` / `0.0.0.0` | Render injects `PORT` |
| `ACCESS_TOKEN_TTL_SECONDS` | no | `900` | |
| `REFRESH_TOKEN_TTL_SECONDS` | no | `2592000` | |
| `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`, `OTP_MAX_PER_PHONE` | no | `300`, `5`, `3` | |
| `RATE_LIMIT_MAX`, `OTP_RATE_LIMIT_MAX` | no | `100`, `10` | per IP per minute |

The mobile app has one build-time variable, `EXPO_PUBLIC_API_URL`.

## Deploy: Neon + Render

1. **Neon:** create a project and copy the connection string.
2. **Render:** New → Web Service → connect the repo → *Runtime: Docker*.
   - Dockerfile path: `apps/api/Dockerfile`
   - Docker build context / root directory: the repo root (`.`)
   - Health check path: `/health`
   - Env vars: `DATABASE_URL`, `JWT_SECRET` (and `NODE_ENV=production`).
3. Deploy. The container's start command runs `prisma migrate deploy` and then the server, so migrations apply on every release.
4. Verify: `curl https://<service>.onrender.com/health` and open `/docs`.
5. Point a free uptime monitor at `/health`.

## Migrations

- Schema changes: edit `apps/api/prisma/schema.prisma`, run `pnpm --filter @miniledger/api prisma:migrate` locally to create a migration, and commit the generated folder.
- Production only ever runs `prisma migrate deploy`, which applies committed migrations and never resets data.
- If a deploy fails mid-migration, Prisma records it as failed. Fix forward with a new migration, or resolve with `prisma migrate resolve` after repairing the state by hand.

## Rollback

1. **Redeploy the previous image** (Render: *Events → Rollback* to the last good deploy). This is the normal path and is safe when the schema didn't change.
2. **Migrations are not rolled back automatically.** Prisma has no "down" migrations. Write migrations as *additive-safe* (add nullable columns/tables, don't drop or rename in the same release) so the previous code keeps working against the newer schema. Remove old columns in a later release, once nothing reads them.
3. Only revert a migration by hand (a new corrective migration) if it is additive and nothing has written to it yet. Never drop a column that holds data as part of a rollback without a backup (Neon offers point-in-time restore on its history window).

## Mobile APK

- **EAS (free tier):** `cd apps/mobile && npx eas-cli login && EXPO_PUBLIC_API_URL=https://<api> npx eas-cli build --platform android --profile preview`. The `preview` profile in `eas.json` produces an installable `.apk`.
- **CI:** the manual *Build Android APK* workflow does the same; add an `EXPO_TOKEN` secret first.
- **Local:** `cd apps/mobile && npx expo prebuild -p android && cd android && ./gradlew assembleRelease` (needs the Android SDK and JDK 17+).

`usesCleartextTraffic` is enabled in `app.json` so the app can talk to a local `http://` API during development. Turn it off for a release that only uses HTTPS.

## If deploying to AWS

The same container works:

1. Build and push the image to **ECR** (`docker build -f apps/api/Dockerfile -t miniledger-api .`).
2. Run it on **App Runner** (simplest) or ECS/EC2. Set the health check to `GET /health`.
3. Put `DATABASE_URL` and `JWT_SECRET` in **SSM Parameter Store** (SecureString) or Secrets Manager, and inject them as environment variables.
4. Use **RDS for PostgreSQL** in private subnets; allow the service's security group on port 5432. Enable automated backups.
5. Logs go to CloudWatch (pino writes JSON to stdout). Add an alarm on `/health` and on 5xx counts.
6. Run `prisma migrate deploy` as a one-off task or pre-deploy step if you don't want every container to attempt it at startup.
