# Kubernetes Deployment Layout

This folder provides a portable deployment structure:

- `base/`: environment-agnostic manifests
- `overlays/local-kind/`: local development on kind (includes in-cluster Postgres/Redis)
- `overlays/cloud-generic/`: cloud-ready overlay (expects managed Postgres/Redis)

## Quick start (local kind)

1. Ensure local kind context exists:

```bash
kubectl config get-contexts
kind create cluster --name funforum # only when kind-funforum is missing
```

2. Build backend image and load into kind manually only if you want to bypass the default staging script refresh:

```bash
docker build -f ops/packaging/services/llm-forum.Dockerfile -t fun-forum-api:dev .
kind load docker-image fun-forum-api:dev --name funforum
```

3. Inject LLM API key and apply local staging overlay.
By default the staging script now rebuilds `fun-forum-api:dev`, loads it into kind, applies the overlay, and verifies runtime fingerprint parity through `GET /v1/admin/runtime/features`:

```bash
export LLM_API_KEY=<your-llm-api-key>
pnpm k8s:staging:local -- --k8s-context kind-funforum
```

4. Test ingress:

```bash
curl -H 'Host: api.funforum.local' http://127.0.0.1/health
```

5. Optional: run local K8s smoke rehearsal in one command:

```bash
export LLM_API_KEY=<your-llm-api-key>
pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum
```

Notes:
- `scripts/k8s-local-staging.mjs` applies `overlays/local-kind`, runs `pnpm db:migrate:deploy` through a temporary Postgres port-forward (default), injects `LLM_API_KEY` into `secret/forum-app-secret`, restarts `deploy/backend`, and waits for rollout.
- If the default backend local port (`4100`) is already occupied, `scripts/k8s-local-staging.mjs` now auto-falls back to the next available local port and prints the chosen port in the runtime fingerprint log.
- If context is missing and `kind` is installed, you can auto-create it by adding `--create-kind-if-missing`.
- If you already migrated schema and want a faster rerun, add `--skip-db-migrate`.
- The API key is read from env (default: `LLM_API_KEY`) and is not written into repo files.

## Cloud migration notes

Use `overlays/cloud-generic` as baseline and replace:

- Ingress class/annotations for your cloud LB
- `forum-app-secret` with managed DB/Redis endpoints
- image registry and tag
- optional TLS cert integration (cert-manager or cloud cert)

Render without applying:

```bash
kubectl kustomize ops/deploy/k8s/overlays/cloud-generic
```

## T-023 ~ T-025 local smoke scripts

Reusable local smoke scripts are provided under `scripts/`:

- `scripts/t023-runtime-k8s-smoke-suite.mjs`
- `scripts/t024-consistency-smoke.mjs`
- `scripts/t025-sse-fanout-smoke.mjs`
- `scripts/t023-t025-k8s-smoke-suite.mjs` (run all in order)

Run via `pnpm`:

```bash
pnpm smoke:t023:k8s
pnpm smoke:t024:k8s
pnpm smoke:t025:k8s
pnpm smoke:t023-t025:k8s
```

Common optional parameters:

```bash
pnpm smoke:t023-t025:k8s -- --k8s-context kind-funforum --k8s-namespace funforum
```
