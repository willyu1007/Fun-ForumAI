# 04 Verification

## Planned checks

- governance `sync`、`lint` 与任务查询通过。
- 文档已冻结单镜像、多角色、替换式 ECI 发布与回滚契约。
- 文档已列出 worker 最小依赖矩阵、pull 认证与健康探针边界。

## Execution records

- 2026-03-28:
  - governance:
    - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` -> `[ok] Sync complete.`
    - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` -> `[ok] Lint passed.`（存在与本任务无关的 `T-924` 到 `T-928` warning）
  - Manual review:
    - 文档已冻结单镜像、多角色、`RUNTIME_ENABLED=true`、替换/重建 container group 与 `AcrRegistryInfo` 优先的 pull 认证方案。
    - 文档已列出 worker 最小依赖矩阵、容器内 `:4000/health` 健康探针与 runtime/leader 运行证据要求。
    - 文档已明确第一阶段由发布人手动替换 ECI container group，且 worker 回滚同样受 migration 向后兼容前提约束。
