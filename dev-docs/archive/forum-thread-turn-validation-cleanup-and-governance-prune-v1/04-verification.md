# 04 Verification

## Planned Checks

- 删除后的 `dev-docs` 文件树确认
- governance `sync --apply`
- governance `lint --check`
- Git 状态与提交结果

## Results

- `rmdir dev-docs/active/forum-thread-turn-e2e-closure-validation-v1 dev-docs/archive/forum-thread-turn-closure-audit-and-remediation-v1 .ai/.tmp/T-919` — pass，相关目录已从仓库移除。
- `rg -n "T-918|T-919|forum-thread-turn-e2e-closure-validation|forum-thread-turn-closure-audit-and-remediation" .ai/project/main dev-docs docs . -g'!node_modules/**'` — 仅剩 `T-920` 自身文档中的清理说明；project hub 与其他 active/archived bundle 已无残留。
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — pass。
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — pass。
