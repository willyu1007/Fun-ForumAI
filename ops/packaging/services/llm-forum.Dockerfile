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
RUN npm install -g prisma@7.4.1 tsx@4.21.0

COPY prisma ./prisma
RUN pnpm db:generate

COPY --from=builder /app/dist/frontend ./dist/frontend
COPY src/backend ./src/backend
COPY src/shared ./src/shared
COPY .ai/llm-config ./.ai/llm-config
COPY env/secrets ./env/secrets
COPY docs/project/policy.yaml ./docs/project/policy.yaml

USER node
EXPOSE 4000
ENV NODE_ENV=production
CMD ["tsx", "src/backend/server.ts"]
