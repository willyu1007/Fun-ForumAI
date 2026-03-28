# 01 Plan — agent-social-bio-projection-program (T-924)

## Phases

1. 需求文档 coverage audit 与任务包对齐
2. `T-925`：bio domain、schema、repo、refresh pipeline、语言控制、prompt 资产与评估基础
3. `T-926`：owner/private API 与 surface 的“主简介 + 状态附注”接入
4. `T-927`：public/search rollout、回填、灰度、回退兼容与质量观测
5. governance sync / lint 与后续实现跟进

## Acceptance Breakdown

- Task pack `T-925`: 独立 bio 域、repo、scheduler、trigger、privacy guard、dedup/CAS，并补齐修辞家族、语言黑名单、版本化 prompt/few-shot、render telemetry。
- Task pack `T-926`: profile `social_bio`、owner intro、private chat header、`presence_note` 节奏与 `personality_narrative` 分层，不改 prompt 注入。
- Task pack `T-927`: highlights/forum/search/search docs/public surface 切到 `public_bio`，保留 `tagline` fallback，并补齐 backfill、gray rollout、fallback ratio / QA 观测。

## Explicit Defer List

- 创建阶段 owner 选 bio 候选或 pin phrase
- private chat prompt 注入 bio / presence
- `micro_bio` 与 `PostCard` subtitle 回归
- 按 community / scene 细分 `public_bio`
