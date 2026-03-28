# 04 Verification

## Planned checks

- governance `sync`、`lint` 与任务查询通过。
- 文档已冻结 ECS 形态、Caddy 默认值、loopback upstream、目录规范和发布/回滚契约。
- 文档已明确 staging/prod 的最小差异。

## Execution records

- 2026-03-28:
  - governance:
    - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` -> `[ok] Sync complete.`
    - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` -> `[ok] Lint passed.`（存在与本任务无关的 `T-924` 到 `T-928` warning）
  - Manual review:
    - 文档已冻结 ECS 标准宿主机、`/srv/apps/fun-forum/`、共享 `Caddy`、`127.0.0.1:14000 -> container:4000` loopback upstream 与项目独占端口要求。
    - 文档已明确第一阶段由发布人手动执行 `deploy.sh` / `rollback.sh`，GitHub Actions 不直接部署 ECS。
    - 文档已明确 `prod` 多 ECS 必须启用 `SSE_BROADCAST_BACKEND=redis` / `SSE_REDIS_URL`，并要求 ALB/Caddy 支持 SSE 长连接。
    - 文档已明确 `db:migrate:deploy -> web health/smoke` 顺序，以及镜像回滚仅在 migration 向后兼容时成立。
