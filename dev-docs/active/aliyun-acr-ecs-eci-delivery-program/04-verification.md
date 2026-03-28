# 04 Verification

## Planned checks

- 检查 `T-128` 到 `T-131` 是否都包含完整 bundle 文件集合。
- 运行 `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`。
- 运行 `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`。
- 运行 `node .ai/scripts/ctl-project-governance.mjs query --project main --text "acr"`。

## Execution records

- 2026-03-28:
  - `find dev-docs/active/<task> -maxdepth 1 -type f | wc -l`
    - `T-128`: 8 files
    - `T-129`: 8 files
    - `T-130`: 8 files
    - `T-131`: 8 files
    - Result: 四个任务包都具备完整 bundle 文件集合。
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
    - Result: `[ok] Sync complete.`
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
    - Result: `[ok] Lint passed.`
    - Note: 仍有与本任务无关的历史 warning，指向缺失的 `T-924` 到 `T-928` 任务目录。
  - `node .ai/scripts/ctl-project-governance.mjs query --project main --text "acr"`
    - Result: 返回 `T-128 aliyun-acr-ecs-eci-delivery-program` 与 `T-129 github-actions-acr-image-publishing`，说明新任务已可被 project hub 检索。
  - Manual review:
    - `T-128` 已补入第一阶段人工部署控制面、prod 多 ECS 的 SSE Redis 广播与长连接前提、以及 migration 向后兼容/DB 回退前提。
