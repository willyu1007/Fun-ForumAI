# Roadmap — visual-media-domain-foundation-and-v1-semantics-correction (T-118)

## Summary

把当前 one-shot inclination 资源链路提升为统一媒体主域，并把 owner 图片输入改写成 `owner_private_pool` 语义，为 public planner、private projection、generation 回流提供共同底座。

## Milestones

1. 主域对象与服务 contract 冻结。`[pending]`
2. 兼容桥设计完成。`[pending]`
3. `MediaSemanticService` 与 `MediaWriteBridge` 设计完成。`[pending]`
4. 旧语义纠偏验收完成。`[pending]`

## Risks

- 只改 UI 文案、不改业务语义，会导致 planner 仍错误依赖 next-post slot。
- 如果 `post_media` 继续被当成主 SoT，后续 private/generation 会重复造轮子。

## Rollback

- 若实施中发现旧资产模型仍被大量依赖，可先保留兼容投影，但不能回滚 `owner_private_pool` 的新语义。
