# 03 Implementation Notes

## Current status
- 状态：governance-package-created
- 说明：本次提交完成母包与三个子包的任务束初始化，并完成项目治理映射；随后补齐了完整事件接入矩阵、中央文案层、inline payoff、渐进式揭示和延迟回流的 owner。产品代码尚未开始实现。

## Execution log
- 2026-03-10：
  - 创建 `T-077 guidance-onboarding-v1-master`
  - 创建 `T-078 guidance-platform-foundation`
  - 创建 `T-079 guidance-web-core-experience`
  - 创建 `T-080 guidance-recall-and-observability`
  - 在 `.ai/project/main/registry.yaml` 中新增 `F-040` 与 `R-040` 到 `R-043`
  - 固定 4 个任务束的依赖顺序、范围和验收边界
  - 对照 guidance system design 复核缺口，补齐：
    - `T-078` 承接完整事件接入矩阵与 `guidance-copy-service`
    - `T-079` 承接帖子页 / Agent 页 / following feed / memories / chronicle / achievements surface 以及 Day 0 渐进式揭示
    - `T-080` 承接 teaching-first 前 3 次召回、`USE_FOLLOWING_FEED` / owner loop / ready receipt 的延迟回流
  - 运行 `ctl-project-governance sync --apply --project main --changelog`，刷新 `dashboard.md`、`feature-map.md`、`task-index.md`
  - 运行 `ctl-project-governance lint --check --project main`，通过；仅存在与本任务无关的历史 warning（`T-075` 状态值仍为 `in_progress`）
  - 运行 query 确认 `T-077` 到 `T-080` 均可被项目 hub 检索

## Follow-ups
- `T-078` 进入实现时，先冻结 `summary.modules[]`、reason code、state merge、完整事件接入矩阵和 `guidance-copy-service` contract。
- `T-079` 启动前，必须引用 `T-078` 的 frozen contract，不得自行补 event/stage/reason。
- `T-080` 启动前，必须确认 canonical guidance item 已在首页 / inbox / inline / receipt 闭环稳定。

## 2026-03-10 implementation update
- `T-078` 已进入产品代码实现：
  - backend guidance schema / repo / service / route / SSE / hook wiring 已落地；
  - canonical module contract 已用于 summary / inbox / receipt。
- `T-079` 已进入产品代码实现：
  - 首页首屏已改为 dual entry + proof；
  - inbox、private receipt、owner reveal gate 已接入。
- 当前剩余风险集中在 repo 既有 typecheck 噪音与部分 explanation surface 未补全，尚未进入 `T-080`。
