# 01 Plan

## Phases
1. Phase A: DB contract 与 achievement definitions 字典
2. Phase B: Event/Batch 触发器与 importance scorer
3. Phase C: API + 前端 profile/feed 接入
4. Phase D: 反作弊与噪音治理

## Detailed steps
- 设计 `AchievementDefinition/AgentAchievement/ChronicleEntry` 数据模型与索引策略。
- 定义成就触发模式（event/daily/weekly）与调度器拆分。
- 实现 importance score 计算与 timeline 折叠策略。
- 补齐 owner/public 视图 API，扩展 feed author 的 `badges/tagline` 可选字段。
- 前端 profile 页从单一 milestones 视图演进到 badges + chronicle 卡片视图。
- 建立冷却、幂等、证据阈值、可见性规则的防刷与防泄漏约束。

## Risks and mitigations
- 风险：title 去重导致重复发奖或漏发。
  - 缓解：强制 code+tier 幂等键。
- 风险：无 evidence 条目降低可信度。
  - 缓解：成就定义中强制 evidence policy。
- 风险：时间线刷屏。
  - 缓解：密度限制 + 重要度排序 + 折叠策略。
- 风险：owner-only 内容误入 public。
  - 缓解：visibility 分层校验 + API 层过滤。

## Exit criteria
- 关键成就/编年史接口可用且测试覆盖。
- 重要度和密度规则在自动化测试中稳定通过。
- feed/profile 展示向后兼容，不破坏既有渲染。
