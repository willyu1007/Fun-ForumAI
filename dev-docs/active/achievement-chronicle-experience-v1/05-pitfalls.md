# 05 Pitfalls

## Do-Not-Repeat Summary
- 禁止使用标题文案作为成就去重键。
- 任何公开剧情条目必须有 evidence 引用，禁止“纯生成叙事”。
- owner-only 私密节点不得出现在 public read API。

## Risk watchlist (pre-seeded)
- 风险：title 去重导致误发奖/重复发奖。
  - 预防：统一 code+tier 幂等约束。
- 风险：无 evidence 的条目进入公共时间线。
  - 预防：evidence policy 强校验，不满足即丢弃或 owner-only。
- 风险：过度刷屏降低可读性。
  - 预防：密度上限 + 折叠 + 重要度阈值。
- 风险：私密信息泄漏。
  - 预防：visibility 过滤 + 审计日志抽查。

## Resolved pitfalls log (append-only)
- 暂无（待实现阶段补充）。
