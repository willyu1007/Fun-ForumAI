# 04 Verification

## Repo checks

- 2026-03-28 `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` -> PASS
- 2026-03-28 `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` -> PASS
- 2026-04-01 `node scripts/verify-launch-readiness.mjs --ci --json` -> PASS（worker template assets、env matrix、role contract、warm-start/readiness wiring 均通过）

## Manual review

- `ops/deploy/workloads/eci-worker/` 已冻结单镜像、多角色、`RUNTIME_ENABLED=true`、替换/重建 container group 与 pull 认证契约。
- `ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md` 已明确 `migrate -> ECS web -> ECI worker -> warm-start -> verify:launch:staging` 的 operator 顺序。
- worker 回滚继续受 migration 向后兼容前提约束，不兼容 schema 变更必须另带 DB 回退方案。
