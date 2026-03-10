# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（允许历史 warning） |
| `node .ai/scripts/ctl-project-governance.mjs query --project main --text "guidance-onboarding-v1-master"` | 返回 `T-077` |
| `node .ai/scripts/ctl-project-governance.mjs query --project main --text "guidance-platform-foundation"` | 返回 `T-078` |
| `node .ai/scripts/ctl-project-governance.mjs query --project main --text "guidance-web-core-experience"` | 返回 `T-079` |
| `node .ai/scripts/ctl-project-governance.mjs query --project main --text "guidance-recall-and-observability"` | 返回 `T-080` |

## Governance checklist
- [x] 四个任务束目录存在。
- [x] 四个 `.ai-task.yaml` 合法且 task id 不冲突。
- [x] registry 中 feature / requirement / task 映射已补齐。
- [x] 母包状态与 registry 状态一致。
- [x] `feature-map.md` 与 `task-index.md` 已生成 `F-040` 与 `T-077` 到 `T-080`。
- [x] 完整事件接入矩阵有明确 owner（`T-078`）。
- [x] 中央文案层有明确 owner（`T-078`）。
- [x] spectator inline payoff surface 有明确 owner（`T-079`）。
- [x] Day 0 渐进式揭示有明确 owner（`T-079`）。
- [x] `USE_FOLLOWING_FEED` / owner loop / ready receipt 的延迟回流有明确 owner（`T-080`）。
- [ ] `T-078` 实现启动后补充技术验证记录。

## Execution log
- 2026-03-10 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` | pass
- 2026-03-10 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（存在与本任务无关的历史 warning：`T-075` 使用 `in_progress`）
- 2026-03-10 | `node .ai/scripts/ctl-project-governance.mjs query --project main --text "guidance-onboarding-v1-master"` | pass（返回 `T-077`）
- 2026-03-10 | `node .ai/scripts/ctl-project-governance.mjs query --project main --text "guidance-platform-foundation"` | pass（返回 `T-078`）
- 2026-03-10 | `node .ai/scripts/ctl-project-governance.mjs query --project main --text "guidance-web-core-experience"` | pass（返回 `T-079`）
- 2026-03-10 | `node .ai/scripts/ctl-project-governance.mjs query --project main --text "guidance-recall-and-observability"` | pass（返回 `T-080`）
- 2026-03-10 | doc review against `fun-forumai-guidance-system-design.md` | pass（已为事件矩阵、中央文案层、inline payoff、渐进式揭示、延迟回流补齐 owner）
