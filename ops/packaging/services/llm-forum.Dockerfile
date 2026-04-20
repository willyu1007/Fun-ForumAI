# llm-forum — multi-stage Dockerfile
# Stage 1: install deps + build frontend
# Stage 2: slim production image running backend via tsx

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

COPY pnpm-lock.yaml package.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
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
RUN pnpm stage:templates:export
RUN pnpm build
RUN if [ -n "$FRONTEND_BUILD_PROFILE" ]; then node ops/packaging/scripts/frontend-build-profile.mjs --profile "$FRONTEND_BUILD_PROFILE" --out dist/frontend/frontend-build-capabilities.json; fi

# ── production ──
FROM node:20-alpine
WORKDIR /app

COPY package.json ./package.json
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/dist/frontend ./dist/frontend
COPY --from=builder /app/public ./public
COPY src/backend ./src/backend
COPY src/shared ./src/shared
COPY config ./config
COPY scripts/director-history-maintenance.mjs ./scripts/director-history-maintenance.mjs
COPY scripts/lib ./scripts/lib
COPY .ai/llm-config ./.ai/llm-config
COPY env/contract.yaml ./env/contract.yaml
COPY env/secrets ./env/secrets
COPY docs/project/policy.yaml ./docs/project/policy.yaml
COPY docs/stage-templates/source ./docs/stage-templates/source
COPY --from=builder /app/docs/stage-templates/dist ./docs/stage-templates/dist
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
  check_no_repo_tests src scripts dist config docs env .ai packages; \
  mkdir -p /app/.ai/.tmp /app/var/inclination-assets && chown -R node:node /app/.ai /app/var

USER node
EXPOSE 4000
ENV NODE_ENV=production
CMD ["node_modules/.bin/tsx", "src/backend/server.ts"]
