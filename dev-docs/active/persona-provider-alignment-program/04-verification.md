# 04 Verification — T-062

| Command | Purpose | Result |
|---|---|---|
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | 注册新任务包并刷新 derived views | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | 校验 project hub / dev-docs 一致性 | pass（仅报告既有 active done 任务的旧 warning，与 T-062~T-066 无关） |
