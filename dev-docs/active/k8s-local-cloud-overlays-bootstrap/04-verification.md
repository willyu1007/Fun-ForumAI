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

## 2026-03-04 — Stability convergence verification

### Local code verification
- `pnpm -s typecheck`
  - Result: pass
- `pnpm -s test src/backend/runtime/__tests__/event-bridge.test.ts src/backend/runtime/__tests__/event-queue.test.ts src/backend/runtime/__tests__/leader-elector.test.ts`
  - Result: pass
- `pnpm -s test`
  - Result: fail (1 flaky/non-deterministic existing case)
  - Failure:
    - `src/backend/routes/__tests__/e2e.test.ts` -> `consumes pending inclination asset on next scheduled post and writes post media`
    - Observed `uploadRes.status` expected `201`, actual `401`
- Script contract checks:
  - `node scripts/runtime-staging-smoke.mjs --help` -> pass
  - `node scripts/t023-runtime-k8s-smoke-suite.mjs --help` -> pass
  - `node scripts/t025-sse-fanout-smoke.mjs --help` -> pass

### Cluster rollout verification
- `docker build -f ops/packaging/services/llm-forum.Dockerfile -t fun-forum-api:dev .`
  - Result: pass
- `kind load docker-image fun-forum-api:dev --name funforum`
  - Result: pass
- `LLM_API_KEY=*** pnpm -s k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum --skip-db-migrate`
  - Result: pass
- Config confirmation:
  - `kubectl ... get configmap forum-app-config -o jsonpath='{.data.NODE_OPTIONS}'` -> `--max-old-space-size=1024`
  - `kubectl ... get deploy backend -o jsonpath='{...resources...}'` -> `512Mi 2Gi`
  - `kubectl logs deploy/backend --tail=120 | rg 'PPR hydration skipped'` -> hit

### T-023~T-025 stability acceptance (3 consecutive runs)
- Command (three consecutive rounds):
  - `pnpm -s smoke:t023-t025:k8s --k8s-context kind-funforum --k8s-namespace funforum`
- Round 1:
  - Result: pass
  - Pod restart delta: `0 -> 0`
  - Evidence: T-025 post `cmmc6gcfj00000mgcgpbqmjgj`
- Round 2:
  - Result: pass
  - Pod restart delta: `0 -> 0`
  - Evidence: T-025 post `cmmc6js3a00000mijfpq6jny2`
- Round 3:
  - Result: pass
  - Pod restart delta: `0 -> 0`
  - Evidence: T-025 post `cmmc6n4wg00000mdg1z112f1u`
- Verdict:
  - `PASS: 3/3 consecutive suite passes`
  - `PASS: no new backend restart in acceptance window`

### Browser/manual smoke (via port-forward + chrome tool)
- Port-forward:
  - `kubectl --context kind-funforum -n funforum port-forward svc/backend 4400:80`
- Checked:
  - `GET http://127.0.0.1:4400/health` -> 200 body with `status=ok`
  - `GET http://127.0.0.1:4400/v1/posts/cmmc6n4wg00000mdg1z112f1u` -> 200 with expected post payload
  - SSE endpoint:
    - Browser network request `GET /v1/events/stream` observed as `pending` (long-lived stream connection)
