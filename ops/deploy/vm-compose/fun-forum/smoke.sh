#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOOPBACK_PORT="${LOOPBACK_PORT:-14000}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-fun-forum}"
BASE_URL="http://127.0.0.1:${LOOPBACK_PORT}"

cd "$APP_DIR"

echo "[smoke] GET ${BASE_URL}/health"
health_body="$(curl -fsS "${BASE_URL}/health")"
printf '%s' "$health_body" | grep -q '"status":"ok"' || {
  echo "[error] /health did not return status=ok" >&2
  exit 1
}

echo "[smoke] GET ${BASE_URL}/v1/health"
api_health_body="$(curl -fsS "${BASE_URL}/v1/health")"
printf '%s' "$api_health_body" | grep -q '"status":"ok"' || {
  echo "[error] /v1/health did not return status=ok" >&2
  exit 1
}

echo "[smoke] verify web runtime role"
docker compose exec -T web /bin/sh -lc 'test "${RUNTIME_ENABLED:-}" = "false"'

echo "[ok] smoke checks passed"
