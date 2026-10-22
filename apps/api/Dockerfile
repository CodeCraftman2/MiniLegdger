# Build context is the repo root:  docker build -f apps/api/Dockerfile .
FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @miniledger/api...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @miniledger/api exec prisma generate && pnpm --filter @miniledger/api build

FROM node:22-slim AS runtime
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./

WORKDIR /repo/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-3000}/health || exit 1

# Apply pending migrations, then start. `migrate deploy` only runs committed migrations (never resets data).
CMD ["sh", "-c", "node /repo/node_modules/prisma/build/index.js migrate deploy && node dist/server.js"]
