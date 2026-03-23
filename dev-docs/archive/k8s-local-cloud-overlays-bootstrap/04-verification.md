# 04 Verification

## Key Checks
- `kubectl kustomize ops/deploy/k8s/base` — pass
- `kubectl kustomize ops/deploy/k8s/overlays/local-kind` — pass
- `kubectl kustomize ops/deploy/k8s/overlays/cloud-generic` — pass
- `kubectl apply --dry-run=client -k ops/deploy/k8s/overlays/local-kind` — pass
- `kubectl apply --dry-run=client -k ops/deploy/k8s/overlays/cloud-generic` — pass
- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:15432/llm_forum pnpm prisma migrate deploy` — pass (backend 2/2 ready, ingress health check returns status ok)

## Coverage
- Kustomize render
- Client-side apply dry-run
- Real deployment execution (kind-funforum)
- Prompt registry fix + cleanup (2026-02-25)
- Reusable smoke scripts validation (2026-02-25)
