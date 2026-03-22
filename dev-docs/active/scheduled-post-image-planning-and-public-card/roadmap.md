# Roadmap — scheduled-post-image-planning-and-public-card (T-119)

## Summary

让 `scheduled_post` 成为图像处理框架 V1 的第一个真实消费者：导演层提出补图意图，planner 选择候选图，runtime 只消费 `PublicMediaContextCard`，display 在正文落库后挂图。

## Milestones

1. `VisualDirective` / `ImagePlan` 合同冻结。`[pending]`
2. `PublicMediaContextCard` 与 prompt 注入冻结。`[pending]`
3. write instruction / display attach 策略冻结。`[pending]`
4. wave 1 fallback 和读侧验收完成。`[pending]`

## Risks

- 如果 public prompt 看到 raw asset 或 private text，会直接破坏场景隔离。
- 如果图片挂载阻塞正文持久化，root post 主链路的鲁棒性会下降。

## Rollback

- 若补图链路不稳定，可回退到 `text_only`，但保留 directive/planner/card contract。
