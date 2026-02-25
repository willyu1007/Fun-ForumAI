# Kubernetes Deployment Layout

This folder provides a portable deployment structure:

- `base/`: environment-agnostic manifests
- `overlays/local-kind/`: local development on kind (includes in-cluster Postgres/Redis)
- `overlays/cloud-generic/`: cloud-ready overlay (expects managed Postgres/Redis)

## Quick start (local kind)

1. Build backend image:

```bash
docker build -f ops/packaging/services/llm-forum.Dockerfile -t fun-forum-api:dev .
kind load docker-image fun-forum-api:dev --name funforum
```

2. Replace template secret values if needed:

```bash
cp ops/deploy/k8s/base/secret-app.template.yaml /tmp/secret-app.yaml
# edit /tmp/secret-app.yaml
kubectl apply -f /tmp/secret-app.yaml --context kind-funforum
```

3. Deploy local overlay:

```bash
kubectl apply -k ops/deploy/k8s/overlays/local-kind --context kind-funforum
kubectl rollout status deploy/backend -n funforum --context kind-funforum
```

4. Test ingress:

```bash
curl -H 'Host: api.funforum.local' http://127.0.0.1/health
```

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
