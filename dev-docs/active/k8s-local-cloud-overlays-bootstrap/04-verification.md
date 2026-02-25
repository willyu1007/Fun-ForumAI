# 04 Verification

## 2026-02-25

### Kustomize render
- `kubectl kustomize ops/deploy/k8s/base`
- `kubectl kustomize ops/deploy/k8s/overlays/local-kind`
- `kubectl kustomize ops/deploy/k8s/overlays/cloud-generic`
- Result: pass

### Client-side apply dry-run
- `kubectl apply --dry-run=client -k ops/deploy/k8s/overlays/local-kind`
- `kubectl apply --dry-run=client -k ops/deploy/k8s/overlays/cloud-generic`
- Result: pass

### Real deployment execution (kind-funforum)
- `docker build -f ops/packaging/services/llm-forum.Dockerfile -t fun-forum-api:dev .`
- `kind load docker-image fun-forum-api:dev --name funforum`
- `kubectl apply -f ops/deploy/k8s/base/namespace.yaml --context kind-funforum`
- `kubectl apply -f ops/deploy/k8s/overlays/local-kind/postgres.yaml --context kind-funforum`
- `kubectl apply -f ops/deploy/k8s/overlays/local-kind/redis.yaml --context kind-funforum`
- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:15432/llm_forum pnpm prisma migrate deploy` (with temporary port-forward)
- `kubectl apply -k ops/deploy/k8s/overlays/local-kind --context kind-funforum`
- `kubectl rollout status deploy/backend -n funforum --context kind-funforum`
- `curl -H 'Host: api.funforum.local' http://127.0.0.1/health`
- Result: pass (backend 2/2 ready, ingress health check returns status ok)

### Prompt registry fix + cleanup (2026-02-25)
- `docker build -f ops/packaging/services/llm-forum.Dockerfile -t fun-forum-api:dev .`
- `kind load docker-image fun-forum-api:dev --name funforum`
- `kubectl rollout restart deploy/backend -n funforum --context kind-funforum`
- `kubectl rollout status deploy/backend -n funforum --context kind-funforum`
- `kubectl logs deploy/backend -n funforum --tail=80 --context kind-funforum`
  - Expected: `[PromptEngine] Loaded 5 templates`
- `kubectl delete deploy/hello svc/hello ingress/hello -n funforum --ignore-not-found --context kind-funforum`
- `curl -H 'Host: api.funforum.local' http://127.0.0.1/health`
- Result: pass

### Reusable smoke scripts validation (2026-02-25)
- `pnpm smoke:t023-t025:k8s`
- Result: pass
  - T-023: pass
  - T-024: pass
  - T-025: pass
- Evidence samples:
  - T-024 post id: `cmm2ms996000c19ki04y0mss4`
  - T-024 comment id: `cmm2ms99s000319mtbzn7id42`
  - T-025 post id: `cmm2msqg0000019nb9yadc9yp`
