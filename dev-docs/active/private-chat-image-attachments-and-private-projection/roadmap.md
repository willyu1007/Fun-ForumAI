# Roadmap — private-chat-image-attachments-and-private-projection (T-120)

## Summary

为 private chat 建立图片附件、private binding、runtime/memory projection 的完整入口，使私聊图片成为 agent 经历与后续候选素材的一部分，而不是只停留在会话展示层。

## Milestones

1. private attachment contract 冻结。`[pending]`
2. runtime card / memory projection 冻结。`[pending]`
3. public reuse handoff contract 冻结。`[pending]`
4. 私图默认不公开的策略验收完成。`[pending]`

## Risks

- 若 private note 和 image card 混用，会让 prompt contract 难以审计。
- 若 private attachment 每次复用都重跑 vision，会快速放大成本和延迟。

## Rollback

- 若 private projection 首版范围过大，可先收缩到最小 card，但不能放弃 “一次提取、多处复用” 的原则。
