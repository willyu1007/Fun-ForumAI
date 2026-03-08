# 05 Pitfalls — T-062

## Do-not-repeat summary
- 不要把 `T-062` 写成子包实现细节的复制品；它只负责治理和依赖。
- 不要把本轮规划并回 `T-045 / T-046 / T-048 / T-049`，否则会破坏上游任务边界。

## 2026-03-08 - 人格规划边界容易与既有任务重叠
- Symptom: 新规划同时涉及 identity、prompt、provider，看起来像对 T-045/T-046/T-048 的 reopen。
- Root cause: 上游任务覆盖了人格基础设施的一部分，但未覆盖 provider/runtime alignment 这一层。
- What was tried: 对比现有 dev-docs 与代码现状，确认上游任务只作为基础依赖。
- Fix/workaround: 新建 `T-062~T-066`，显式声明“上游基础，不 reopen”。
- Prevention note: 之后新增人格相关规划时，优先先判断是扩展 requirement 还是 reopen 旧 task，不要默认覆盖原任务。
