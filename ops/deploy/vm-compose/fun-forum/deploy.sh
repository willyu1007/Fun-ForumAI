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
  ./deploy.sh --image-ref <acr/...:sha-<commit>> [--with-migrate] --db-compat <backwards|incompatible> [--db-plan <ticket>] [--notes <text>]
  ./deploy.sh --sha <40-char-commit> [--with-migrate] --db-compat <backwards|incompatible> [--db-plan <ticket>] [--notes <text>]

Required environment variables:
  ACR_PULL_USERNAME
  ACR_PULL_PASSWORD

Required when using --sha:
  ACR_IMAGE_REPOSITORY=<acr-login-server>/<namespace>/app
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

validate_commit_sha() {
  [[ "${1:-}" =~ ^[a-fA-F0-9]{40}$ ]] || die "--sha must be a full 40-character commit sha."
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

load_host_env() {
  [[ -f "$APP_DIR/.env" ]] || die "Missing $APP_DIR/.env"
  [[ -f "$APP_DIR/compose.yaml" ]] || die "Missing $APP_DIR/compose.yaml"
  [[ -x "$APP_DIR/smoke.sh" ]] || die "Missing executable $APP_DIR/smoke.sh"

  APP_ENV="$(extract_env_value APP_ENV)"
  [[ "$APP_ENV" =~ ^(dev|staging|prod)$ ]] || die "APP_ENV must be set in .env (dev|staging|prod)."
  grep -Eq '^DATABASE_URL=' "$APP_DIR/.env" || die "DATABASE_URL must be set in .env."
}

validate_compose_contract() {
  local entrypoint_count
  entrypoint_count="$(grep -Ec '^[[:space:]]*entrypoint:[[:space:]]*\[\][[:space:]]*(#.*)?$' "$APP_DIR/compose.yaml" || true)"
  if (( entrypoint_count < 3 )); then
    die "compose.yaml is stale: web, worker, and migrate must set 'entrypoint: []'. Sync $APP_DIR/compose.yaml from ops/deploy/vm-compose/fun-forum/ before deploying."
  fi

  if ! grep -Eq '^[[:space:]]*command:[[:space:]]*\[[[:space:]]*"node"[[:space:]]*,[[:space:]]*"node_modules/prisma/build/index\.js"[[:space:]]*,[[:space:]]*"migrate"[[:space:]]*,[[:space:]]*"deploy"[[:space:]]*\][[:space:]]*(#.*)?$' "$APP_DIR/compose.yaml"; then
    die "compose.yaml is stale: migrate must run 'node node_modules/prisma/build/index.js migrate deploy' directly. Sync $APP_DIR/compose.yaml from ops/deploy/vm-compose/fun-forum/ before deploying."
  fi
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

IMAGE_REF=""
SOURCE_SHA=""
WITH_MIGRATE="false"
DB_COMPAT=""
DB_PLAN=""
NOTES=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image-ref)
      IMAGE_REF="${2:-}"
      shift 2
      ;;
    --sha)
      SOURCE_SHA="${2:-}"
      shift 2
      ;;
    --with-migrate)
      WITH_MIGRATE="true"
      shift
      ;;
    --db-compat)
      DB_COMPAT="${2:-}"
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
load_host_env

[[ -z "$IMAGE_REF" || -z "$SOURCE_SHA" ]] || die "Use either --image-ref or --sha, not both."
[[ -n "$IMAGE_REF" || -n "$SOURCE_SHA" ]] || die "One of --image-ref or --sha is required."

if [[ -n "$SOURCE_SHA" ]]; then
  validate_commit_sha "$SOURCE_SHA"
  [[ -n "${ACR_IMAGE_REPOSITORY:-}" ]] || die "ACR_IMAGE_REPOSITORY is required when using --sha."
  NORMALIZED_SHA="$(printf '%s' "$SOURCE_SHA" | tr '[:upper:]' '[:lower:]')"
  IMAGE_REF="${ACR_IMAGE_REPOSITORY}:sha-${NORMALIZED_SHA}"
fi

validate_immutable_image_ref "$IMAGE_REF"

case "$DB_COMPAT" in
  backwards|incompatible)
    ;;
  *)
    die "--db-compat must be either backwards or incompatible."
    ;;
esac

if [[ "$DB_COMPAT" == "incompatible" && -z "$DB_PLAN" ]]; then
  die "--db-plan is required when --db-compat incompatible."
fi

if [[ "$APP_ENV" == "staging" && "$WITH_MIGRATE" != "true" ]]; then
  die "staging requires --with-migrate."
fi

export IMAGE_REF
export LOOPBACK_PORT
export WEB_BIND_PORT
export WORKER_HOST_PORT
export CONTAINER_PORT
export COMPOSE_PROJECT_NAME

validate_compose_contract

echo "[info] Validating host files and environment"
echo "[info] Deploying $IMAGE_REF into $APP_ENV from $APP_DIR"

echo "[step] docker login"
docker_login_readonly

if [[ "$APP_ENV" == "staging" ]]; then
  echo "[step] docker compose --profile staging-same-host-worker pull web worker migrate"
  docker compose --profile staging-same-host-worker pull web worker migrate
else
  echo "[step] docker compose pull web migrate"
  docker compose pull web migrate
fi

if [[ "$WITH_MIGRATE" == "true" ]]; then
  echo "[step] docker compose run --rm migrate"
  if [[ "$APP_ENV" == "staging" ]]; then
    docker compose --profile staging-same-host-worker run --rm migrate
  else
    docker compose run --rm migrate
  fi
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
write_release_record "$DEPLOYED_AT" "$DEPLOYED_BY" "$DB_COMPAT" "$DB_PLAN" "$NOTES"

echo "[ok] Deployment succeeded for $IMAGE_REF"
