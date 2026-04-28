# llm-forum — multi-stage Dockerfile
# Stage 1: install deps + build frontend
# Stage 2: assemble the minimal runtime filesystem
# Stage 3: slim production image running backend via tsx

FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=10000 \
    npm_config_fetch_retry_maxtimeout=120000

ARG FRONTEND_BUILD_PROFILE=""
ARG VITE_FF_CHATROOM_STAGING_HOLD_V1="false"

ENV FRONTEND_BUILD_PROFILE=${FRONTEND_BUILD_PROFILE}
ENV VITE_FF_CHATROOM_STAGING_HOLD_V1=${VITE_FF_CHATROOM_STAGING_HOLD_V1}

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/design-tokens/package.json ./packages/design-tokens/package.json
COPY packages/ui-contract/package.json ./packages/ui-contract/package.json
COPY packages/ui-mobile/package.json ./packages/ui-mobile/package.json
COPY packages/ui-web/package.json ./packages/ui-web/package.json
RUN pnpm install --frozen-lockfile
RUN pnpm db:generate

COPY . .
RUN set -eu; \
  check_no_repo_tests() { \
    found="$({ \
      for path in "$@"; do \
        if [ -e "$path" ]; then \
          find "$path" \( -path '*/__tests__' -o -path '*/__tests__/*' -o -name '*.test.*' -o -name '*.spec.*' \) -print; \
        fi; \
      done; \
    } | sort)"; \
    if [ -n "$found" ]; then \
      echo 'Unexpected repo test files in image:'; \
      echo "$found"; \
      exit 1; \
    fi; \
  }; \
  check_no_repo_tests src apps packages scripts ops docs ui
RUN pnpm ui:packages:build
RUN pnpm stage:templates:export
RUN pnpm build
RUN if [ -n "$FRONTEND_BUILD_PROFILE" ]; then node ops/packaging/scripts/frontend-build-profile.mjs --profile "$FRONTEND_BUILD_PROFILE" --out dist/frontend/frontend-build-capabilities.json; fi

FROM node:20-alpine AS runtime-prep
WORKDIR /app

COPY package.json ./package.json
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY src/backend ./src/backend
COPY src/shared ./src/shared
COPY config ./config
COPY --from=builder /app/public ./public
COPY scripts/director-history-maintenance.mjs ./scripts/director-history-maintenance.mjs
COPY scripts/lib ./scripts/lib
COPY .ai/llm-config ./.ai/llm-config
COPY env/contract.yaml ./env/contract.yaml
COPY env/secrets ./env/secrets
COPY docs/project/policy.yaml ./docs/project/policy.yaml
COPY docs/stage-templates/source ./docs/stage-templates/source
COPY packages/design-tokens/package.json ./packages/design-tokens/package.json
COPY --from=builder /app/packages/design-tokens/dist ./packages/design-tokens/dist
COPY packages/design-tokens/styles ./packages/design-tokens/styles
COPY packages/ui-contract/package.json ./packages/ui-contract/package.json
COPY --from=builder /app/packages/ui-contract/dist ./packages/ui-contract/dist
COPY packages/ui-contract/contract ./packages/ui-contract/contract
COPY packages/ui-web/package.json ./packages/ui-web/package.json
COPY --from=builder /app/packages/ui-web/dist ./packages/ui-web/dist
COPY packages/ui-web/styles ./packages/ui-web/styles
COPY packages/ui-mobile/package.json ./packages/ui-mobile/package.json
COPY --from=builder /app/packages/ui-mobile/dist ./packages/ui-mobile/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/frontend ./dist/frontend
COPY --from=builder /app/docs/stage-templates/dist ./docs/stage-templates/dist
RUN set -eu; \
  rm -rf \
    src/backend/dev \
    src/backend/test-support \
    src/backend/test-utils; \
  rm -f \
    src/backend/routes/dev-seed.ts \
    src/backend/routes/dev-kickoff.ts \
    src/backend/routes/dev-badge-debug.ts \
    src/backend/routes/dev-guidance.ts \
    dist/frontend/bundle-report.json; \
  rm -f prisma.config.ts; \
  printf 'import{defineConfig}from"prisma/config";export default defineConfig({schema:"prisma/schema.prisma",migrations:{path:"prisma/migrations"},datasource:{url:process.env.DATABASE_URL}});\n' > prisma.config.js; \
  node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.packageManager;fs.writeFileSync('package.json',JSON.stringify(p));" ; \
  find public dist/frontend -name '.DS_Store' -delete; \
  check_no_repo_tests() { \
    found="$({ \
      for path in "$@"; do \
        if [ -e "$path" ]; then \
          find "$path" \( -path '*/__tests__' -o -path '*/__tests__/*' -o -name '*.test.*' -o -name '*.spec.*' \) -print; \
        fi; \
      done; \
    } | sort)"; \
    if [ -n "$found" ]; then \
      echo 'Unexpected repo test files in image:'; \
      echo "$found"; \
      exit 1; \
    fi; \
  }; \
  check_no_repo_tests src scripts dist config docs env .ai packages public prisma

# ── production ──
FROM node:20-alpine
WORKDIR /app

COPY --from=runtime-prep /app/. ./
RUN set -eu; \
  mkdir -p /app/.ai/.tmp /app/var/inclination-assets && chown -R node:node /app/.ai /app/var

USER node
EXPOSE 4000
ENV NODE_ENV=production
CMD ["node_modules/.bin/tsx", "src/backend/server.ts"]
