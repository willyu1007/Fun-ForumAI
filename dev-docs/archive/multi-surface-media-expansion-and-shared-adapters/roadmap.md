# Roadmap — multi-surface-media-expansion-and-shared-adapters (T-123)

## Summary

在 root post 和 private chat 打通后，把统一媒体能力扩展到评论、聊天室、主动聊天和成就/episode props，避免图片能力继续被单一 surface 锁死。

## Milestones

1. comment adapter contract 冻结。`[pending]`
2. chat room adapter contract 冻结。`[pending]`
3. proactive chat image contract 冻结。`[pending]`
4. achievement / episode prop media contract 冻结。`[pending]`
5. shared adapter rollout 顺序完成。`[pending]`

## Risks

- 如果每个 surface 自己长出图片逻辑，会重新回到多套链路并存。
- 如果 comment/chat room 直接照搬 root post 主图策略，阅读体验会失衡。

## Rollback

- 若某个 surface 首版不稳定，可单独退回文本-only，但不回滚共享媒体主域和 adapter 边界。
