# 05 Pitfalls — T-062

## Do-not-repeat summary
- 不要把 `T-062` 写成子包实现细节的复制品；它只负责治理和依赖。
- 不要把本轮规划并回 `T-045 / T-046 / T-048 / T-049`，否则会破坏上游任务边界。
- 不要把 rollout execution 继续塞在 `T-066` 里；contract/runtime closeout 与真实灰度证据必须分任务管理。

## 2026-03-08 - 人格规划边界容易与既有任务重叠
- Symptom: 新规划同时涉及 identity、prompt、provider，看起来像对 T-045/T-046/T-048 的 reopen。
- Root cause: 上游任务覆盖了人格基础设施的一部分，但未覆盖 provider/runtime alignment 这一层。
- What was tried: 对比现有 dev-docs 与代码现状，确认上游任务只作为基础依赖。
- Fix/workaround: 新建 `T-062~T-066`，显式声明“上游基础，不 reopen”。
- Prevention note: 之后新增人格相关规划时，优先先判断是扩展 requirement 还是 reopen 旧 task，不要默认覆盖原任务。

## 2026-03-09 - 治理漂移与 rollout 证据混装会阻断总包收口
- Symptom: `T-065` 在 bundle 中写成 `implemented`、project hub 仍是 `planned`；`T-066` 已落 contract/runtime 但因真实样本证据未齐而长期停留在 `in-progress`；`T-067~T-069` 甚至未注册到 registry。
- Root cause: contract/runtime closeout 与 rollout execution 的验收面不同，却被放在同一条治理链里管理。
- What was tried: 先对照设计纪要和代码现状重新做 `T-062` 方案级验收，再把 rollout execution 单独抽出 follow-up 包。
- Fix/workaround: 对齐 `00-overview` 与 `.ai-task.yaml` 状态、补齐 `R-030` 和 `T-067~T-070` 映射，并新建 `T-070` 承接 blind review / staging shadow logging / gate verdict。
- Prevention note: 以后任何“合同已完成但 rollout 证据尚未收齐”的工作，都应拆出独立 follow-up 任务，不要让总包或 contract 包长期挂在 `in-progress`。
