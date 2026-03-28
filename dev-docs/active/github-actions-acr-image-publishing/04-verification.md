# 04 Verification

## Planned checks

- governance `sync`、`lint` 与任务查询通过。
- 文档已明确 PR 与 `main` / release tag 的不同职责。
- 文档已明确 `image_ref`、tag、OIDC、runner 形态与 Variables / Secrets 清单。

## Execution records

- 2026-03-28:
  - governance:
    - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` -> `[ok] Sync complete.`
    - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` -> `[ok] Lint passed.`（存在与本任务无关的 `T-924` 到 `T-928` warning）
    - `node .ai/scripts/ctl-project-governance.mjs query --project main --text "acr"` -> 返回 `T-129`
  - Manual review:
    - 文档已明确 `PR` 只做 quality gate + `docker build validate`。
    - 文档已明确 `main` / release tag 做 build + push 到 ACR，但不部署到 ECS/ECI。
    - 文档已明确 `image_ref`、`sha-<commit>`、build-once-promote-many、`GitHub OIDC -> RAM Role -> ACR` 与 Runner 网络假设。
