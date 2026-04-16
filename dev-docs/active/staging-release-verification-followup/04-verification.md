# 04 Verification

## Baseline

- inherited from `T-156` repo-side implementation:
  - candidate suite lifecycle: pass locally
  - runtime baseline admission gate: pass locally
  - admin review/governance UI: pass locally
  - `pnpm prisma validate`: pass
  - `pnpm prisma generate`: pass
- inherited from `T-973` repo-side implementation:
  - real PG + pgvector migration: pass locally / local-kind
  - media injection worker timeout/retry, duplicate reuse, retrieval search integration tests: pass
  - local-kind with real DashScope key reaches `searchable` snapshots: pass
  - mixed-batch and planner retrieval regressions: pass locally / local-kind

## Real staging release verification

- pending
- target evidence to collect:
  - worker startup before activation shows `allow_public_growth=false`
  - candidate suite created and visible in admin Warm-up tab
  - activation creates current baseline
  - `pnpm verify:launch:staging` passes only after activation
  - rendered env / runtime logs prove `FF_MEDIA_INJECTION_V1`, `FF_MEDIA_RETRIEVAL_V1`, `FF_MEDIA_PLANNER_RETRIEVAL_V1`
  - one real media import job completes on staging with `succeeded|partial_succeeded` convergence, persisted OSS artifact keys, and no worker claim/heartbeat drift
  - one real staging import demonstrates `staging s3 -> canonical promote` plus artifact cleanup behavior without treating staging objects as canonical by default
  - one public-safe retrieval query and one owner-private retrieval query both return `searchable` hits with correct scope isolation
  - planner retrieval on staging shows retrieval-off legacy baseline and retrieval-on semantic canonical uplift without duplicate-cluster drift
  - rollback reference and operator notes captured

## 2026-04-16 repo parity audit

- command:
  - `sed -n '1,220p' ops/deploy/k8s/README.md`
  - `sed -n '1,220p' env/values/staging.yaml`
  - `sed -n '1,220p' docs/project/policy.yaml`
  - `sed -n '1,220p' ops/deploy/k8s/overlays/local-kind/patch-configmap.yaml`
- result:
  - local-kind remains a valid functional rehearsal only; it is not the authoritative staging rollout path
  - real staging still has four material deltas that require explicit evidence:
    - `ecs` / `aliyun-eci-container-group` topology instead of retained local-kind K8s
    - true `s3` media storage instead of local PVC / `MEDIA_LOCAL_DIR`
    - `NODE_ENV=production` + Redis-backed runtime services instead of local development defaults
    - multi-process / cloud rollout semantics instead of single-node local validation
  - outcome: media injection/retrieval staging follow-up items were added to this bundle as pending real-env evidence, not treated as already closed by local-kind proof

## 2026-04-16 operator checklist authoring

- artifact:
  - [02-operator-checklist.md](/Users/phoenix/Desktop/project/Fun-ForumAI/dev-docs/active/staging-release-verification-followup/02-operator-checklist.md:1)
- result:
  - task-local operator execution sheet now exists for the staging media tranche
  - checklist reuses canonical rollout runbooks instead of duplicating the whole deployment mainline
  - checklist includes concrete commands for:
    - media flag parity
    - `media:inject` dry-run/apply
    - `media_import_jobs` / `media_import_job_items` evidence
    - `media_retrieval_documents` / `media_embedding_snapshots` evidence
    - scoped retrieval hit check
    - planner retrieval spot-check
