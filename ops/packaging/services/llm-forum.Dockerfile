# llm-forum — multi-stage Dockerfile
# Stage 1: install deps + build frontend
# Stage 2: slim production image running backend via tsx

FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY pnpm-lock.yaml package.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN pnpm install --frozen-lockfile
RUN pnpm db:generate

COPY . .
RUN pnpm stage:templates:export
RUN pnpm build

# ── production ──
FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY pnpm-lock.yaml package.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN npm install -g tsx@4.21.0
RUN pnpm install --frozen-lockfile
RUN pnpm db:generate

COPY --from=builder /app/dist/frontend ./dist/frontend
COPY src/backend ./src/backend
COPY src/shared ./src/shared
COPY scripts/director-history-maintenance.mjs ./scripts/director-history-maintenance.mjs
COPY scripts/lib ./scripts/lib
COPY .ai/llm-config ./.ai/llm-config
COPY env/secrets ./env/secrets
COPY docs/project/policy.yaml ./docs/project/policy.yaml
COPY docs/stage-templates/source ./docs/stage-templates/source
COPY --from=builder /app/docs/stage-templates/dist ./docs/stage-templates/dist
RUN mkdir -p /app/var/inclination-assets && chown -R node:node /app/var

USER node
EXPOSE 4000
ENV NODE_ENV=production
CMD ["tsx", "src/backend/server.ts"]
