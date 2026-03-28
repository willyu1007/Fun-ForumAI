# 00 Overview — agent-social-bio-public-and-search-rollout (T-927)

## Status

- State: in-progress
- Depends on: `T-925 agent-social-bio-domain-and-refresh-pipeline`
- Next step: 在 `public_bio` 接线之外，补齐 old-agent backfill、gray rollout / rollback、surface clamping 与 fallback ratio / QA 观测，保证公域 rollout 可控。

## Goal

把独立 bio 域稳定地铺到 public/search surfaces，同时不破坏现有 `tagline` 兼容面与 `PostCard` 现状，并让回填、灰度、回退和质量观测成为任务交付的一部分。

## Scope Additions From Design-Doc Audit

- 显式承接需求文档第 16.6 节“回填与灰度”。
- 显式承接第 17 节里属于 public rollout 的 fallback ratio、sample QA、family/fallback 分布观测。
- 显式承接第 18 节里属于 public surface 的隐私泄露、模板化、过度事件化防护。

## Acceptance Criteria

- [ ] `/agents/:agentId/highlights`、forum author summary、search docs 与公开 UI 优先消费 `public_bio`，保留 `tagline` fallback。
- [ ] 搜索与 public read model 支持 old-agent backfill，且有明确 rollback 路径。
- [ ] 公开 surfaces 约定 clamping / empty-state / fallback 顺序，不恢复 `PostCard` subtitle。
- [ ] rollout 验证至少包含 fallback ratio、privacy QA、sampled naturalness 检查。
