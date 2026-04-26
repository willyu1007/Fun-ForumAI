#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASES_DIR="$APP_DIR/releases"
CURRENT_RELEASE_FILE="$RELEASES_DIR/current.json"
HISTORY_FILE="$RELEASES_DIR/history.jsonl"
LOOPBACK_PORT="${LOOPBACK_PORT:-14000}"
WEB_BIND_PORT="${WEB_BIND_PORT:-$LOOPBACK_PORT}"
WORKER_HOST_PORT="${WORKER_HOST_PORT:-14001}"
CONTAINER_PORT="${CONTAINER_PORT:-4000}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-fun-forum}"

usage() {
  cat <<'EOF'
Usage:
  ./rollback.sh [--to-image-ref <acr/...:sha-<commit>>] [--db-plan <ticket>] [--notes <text>]

Required environment variables:
  ACR_PULL_USERNAME
  ACR_PULL_PASSWORD

Without --to-image-ref, rollback.sh resolves the previous image from releases/history.jsonl.
EOF
}

die() {
  echo "[error] $*" >&2
  exit 1
}

json_escape() {
  local value="${1:-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '%s' "$value"
}

json_field() {
  local line="$1"
  local key="$2"
  printf '%s\n' "$line" | sed -n "s/.*\"${key}\":\"\\([^\"]*\\)\".*/\\1/p"
}

validate_immutable_image_ref() {
  local image_ref="${1:-}"
  [[ -n "$image_ref" ]] || die "image reference is required."
  [[ "$image_ref" == *:* ]] || die "image reference must include an explicit tag."

  local tag="${image_ref##*:}"
  case "$tag" in
    main|staging|prod|latest)
      die "mutable delivery aliases main/staging/prod/latest are not accepted here."
      ;;
  esac
  [[ "$tag" =~ ^sha-[a-fA-F0-9]{40}$ ]] || die "image reference must use an immutable sha-<commit> tag."
}

extract_env_value() {
  local key="$1"
  local value
  value="$(sed -n "s/^${key}=//p" "$APP_DIR/.env" | tail -n 1)"
  printf '%s' "$value" | tr -d '\r'
}

docker_login_readonly() {
  local login_server
  login_server="${IMAGE_REF%%/*}"
  [[ -n "${ACR_PULL_USERNAME:-}" ]] || die "ACR_PULL_USERNAME is required."
  [[ -n "${ACR_PULL_PASSWORD:-}" ]] || die "ACR_PULL_PASSWORD is required."
  printf '%s' "$ACR_PULL_PASSWORD" | docker login "$login_server" --username "$ACR_PULL_USERNAME" --password-stdin >/dev/null
}

wait_for_health() {
  local url="$1"
  local attempt=1
  while (( attempt <= 30 )); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    attempt=$((attempt + 1))
  done
  die "Health check failed for $url"
}

write_release_record() {
  local deployed_at="$1"
  local deployed_by="$2"
  local db_compat="$3"
  local db_plan="$4"
  local notes="$5"
  local record

  mkdir -p "$RELEASES_DIR"
  record=$(printf '{"image_ref":"%s","deployed_at":"%s","deployed_by":"%s","db_compat":"%s","db_plan":"%s","notes":"%s"}' \
    "$(json_escape "$IMAGE_REF")" \
    "$(json_escape "$deployed_at")" \
    "$(json_escape "$deployed_by")" \
    "$(json_escape "$db_compat")" \
    "$(json_escape "$db_plan")" \
    "$(json_escape "$notes")")

  printf '%s\n' "$record" > "$CURRENT_RELEASE_FILE"
  printf '%s\n' "$record" >> "$HISTORY_FILE"
}

resolve_previous_image_ref() {
  [[ -f "$HISTORY_FILE" ]] || die "Missing $HISTORY_FILE"
  local previous_line
  previous_line="$(tail -n 2 "$HISTORY_FILE" | head -n 1)"
  [[ -n "$previous_line" ]] || die "No previous release record found in $HISTORY_FILE"
  local previous_ref
  previous_ref="$(json_field "$previous_line" "image_ref")"
  [[ -n "$previous_ref" ]] || die "Unable to resolve image_ref from the previous history entry."
  printf '%s' "$previous_ref"
}

CURRENT_IMAGE_REF=""
CURRENT_DB_COMPAT=""
if [[ -f "$CURRENT_RELEASE_FILE" ]]; then
  CURRENT_RELEASE_LINE="$(tr -d '\n' < "$CURRENT_RELEASE_FILE")"
  CURRENT_IMAGE_REF="$(json_field "$CURRENT_RELEASE_LINE" "image_ref")"
  CURRENT_DB_COMPAT="$(json_field "$CURRENT_RELEASE_LINE" "db_compat")"
fi

IMAGE_REF=""
TARGET_IMAGE_REF=""
DB_PLAN=""
NOTES=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --to-image-ref)
      TARGET_IMAGE_REF="${2:-}"
      shift 2
      ;;
    --db-plan)
      DB_PLAN="${2:-}"
      shift 2
      ;;
    --notes)
      NOTES="${2:-}"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

cd "$APP_DIR"
[[ -f "$APP_DIR/.env" ]] || die "Missing $APP_DIR/.env"
[[ -f "$APP_DIR/compose.yaml" ]] || die "Missing $APP_DIR/compose.yaml"
[[ -x "$APP_DIR/smoke.sh" ]] || die "Missing executable $APP_DIR/smoke.sh"
APP_ENV="$(extract_env_value APP_ENV)"
[[ "$APP_ENV" =~ ^(dev|staging|prod)$ ]] || die "APP_ENV must be set in .env (dev|staging|prod)."

if [[ -n "$TARGET_IMAGE_REF" ]]; then
  IMAGE_REF="$TARGET_IMAGE_REF"
else
  IMAGE_REF="$(resolve_previous_image_ref)"
fi

validate_immutable_image_ref "$IMAGE_REF"

if [[ -n "$CURRENT_IMAGE_REF" && "$IMAGE_REF" == "$CURRENT_IMAGE_REF" ]]; then
  die "Rollback target matches the current image_ref."
fi

ROLLBACK_DB_COMPAT="backwards"
if [[ "$CURRENT_DB_COMPAT" == "incompatible" ]]; then
  [[ -n "$DB_PLAN" ]] || die "Current release recorded db_compat=incompatible. Complete DB recovery first, then rerun rollback.sh with --db-plan <ticket-or-note>."
  ROLLBACK_DB_COMPAT="incompatible"
fi

export IMAGE_REF
export LOOPBACK_PORT
export WEB_BIND_PORT
export WORKER_HOST_PORT
export CONTAINER_PORT
export COMPOSE_PROJECT_NAME

echo "[info] Rolling back to $IMAGE_REF from $APP_DIR"

echo "[step] docker login"
docker_login_readonly

if [[ "$APP_ENV" == "staging" ]]; then
  echo "[step] docker compose --profile staging-same-host-worker pull web worker"
  docker compose --profile staging-same-host-worker pull web worker
else
  echo "[step] docker compose pull web"
  docker compose pull web
fi

if [[ "$APP_ENV" == "staging" ]]; then
  echo "[step] docker compose --profile staging-same-host-worker up -d --no-deps web worker"
  docker compose --profile staging-same-host-worker up -d --no-deps web worker
else
  echo "[step] docker compose up -d --no-deps web"
  docker compose up -d --no-deps web
fi

HEALTH_URL="http://127.0.0.1:${LOOPBACK_PORT}/health"
echo "[step] waiting for $HEALTH_URL"
wait_for_health "$HEALTH_URL"

echo "[step] running smoke.sh"
"$APP_DIR/smoke.sh"

DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DEPLOYED_BY="${DEPLOYED_BY:-${USER:-unknown}}"
ROLLBACK_NOTES="rollback"
if [[ -n "$NOTES" ]]; then
  ROLLBACK_NOTES="rollback: $NOTES"
fi
write_release_record "$DEPLOYED_AT" "$DEPLOYED_BY" "$ROLLBACK_DB_COMPAT" "$DB_PLAN" "$ROLLBACK_NOTES"

echo "[ok] Rollback succeeded to $IMAGE_REF"
