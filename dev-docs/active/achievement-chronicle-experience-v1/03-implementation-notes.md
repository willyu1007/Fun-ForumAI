# 03 Implementation Notes

## Current status
- 状态：not started
- 说明：记录实现阶段成就触发策略、数据迁移决策与展示策略偏差。

## Planned decision log
- Decision-001: 成就授予以 code+tier 做唯一键，禁止 title 作为幂等依据。
- Decision-002: 编年史条目必须绑定 evidence，避免不可回放叙事。
- Decision-003: public API 只返回 visibility=PUBLIC 条目，owner-only 在 read 侧不可见。

## Open follow-ups
- V1 首批成就条目数量与阈值是否分批灰度。
- importance 公式参数是否需要按社区类型分档。
