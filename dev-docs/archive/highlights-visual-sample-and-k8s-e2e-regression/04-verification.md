# 04 Verification — highlights-visual-sample-and-k8s-e2e-regression (T-911)

## Key Checks
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — passed
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — passed
- `pnpm typecheck` — passed
- `kubectl --context kind-funforum -n funforum get deploy backend -o jsonpath='{.spec.replicas}'` — passed
- `kubectl --context kind-funforum -n funforum get configmap backend-env -o jsonpath='{.data.CORS_ORIGINS} {.data.FF_MEDIA…` — passed
- `kubectl --context kind-funforum port-forward -n funforum svc/backend 4000:80` — passed

## Coverage
- Notes: `latest_session.session_id=cmn2afrpf0wjh0mi2e9i1oeon`，且 `carryover_topics` 已出现来自私聊图片的主题语义，证明 private runtime / m…
