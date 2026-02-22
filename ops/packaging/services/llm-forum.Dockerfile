# llm-forum — multi-stage Dockerfile
# Stage 1: install deps + build frontend
# Stage 2: slim production image running backend via tsx

FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN pnpm db:generate

COPY . .
RUN pnpm build

# ── production ──
FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile --prod

COPY prisma ./prisma
RUN pnpm db:generate

COPY --from=builder /app/dist/frontend ./dist/frontend
COPY src/backend ./src/backend

USER node
EXPOSE 4000
ENV NODE_ENV=production
CMD ["npx", "tsx", "src/backend/server.ts"]
