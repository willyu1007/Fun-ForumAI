#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASES_DIR="$APP_DIR/releases"
CURRENT_RELEASE_FILE="$RELEASES_DIR/current.json"
LOOPBACK_PORT="${LOOPBACK_PORT:-14000}"
WEB_BIND_PORT="${WEB_BIND_PORT:-$LOOPBACK_PORT}"
WORKER_HOST_PORT="${WORKER_HOST_PORT:-14001}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-fun-forum}"
BASE_URL="http://127.0.0.1:${LOOPBACK_PORT}"

die() {
  echo "[error] $*" >&2
  exit 1
}

json_field() {
  local line="$1"
  local key="$2"
  printf '%s\n' "$line" | sed -n "s/.*\"${key}\":\"\\([^\"]*\\)\".*/\\1/p"
}

resolve_image_ref() {
  if [[ -n "${IMAGE_REF:-}" ]]; then
    printf '%s' "$IMAGE_REF"
    return 0
  fi

  [[ -f "$CURRENT_RELEASE_FILE" ]] || die "IMAGE_REF is not set and $CURRENT_RELEASE_FILE is missing."
  local current_line
  current_line="$(tr -d '\n' < "$CURRENT_RELEASE_FILE")"
  local current_ref
  current_ref="$(json_field "$current_line" "image_ref")"
  [[ -n "$current_ref" ]] || die "Unable to resolve image_ref from $CURRENT_RELEASE_FILE."
  printf '%s' "$current_ref"
}

cd "$APP_DIR"
IMAGE_REF="$(resolve_image_ref)"
export IMAGE_REF
export WEB_BIND_PORT
export WORKER_HOST_PORT

echo "[smoke] GET ${BASE_URL}/health"
health_body="$(curl -fsS "${BASE_URL}/health")"
printf '%s' "$health_body" | grep -q '"ok":true' || {
  echo "[error] /health did not return ok=true" >&2
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
