# 05 Pitfalls — launch-visual-rollout-and-packaging (T-140)

## Do-not-repeat summary (keep current)

- 不要把 visual rollout 继续拆散在首页、T4、highlights 各自的小合同里。
- 不要把“图多”误当成“包装完成”。
- 不要在预算耗尽时阻断内容发布，应先退回文本卡。
- 不要在 `FF_MEDIA_ROLLOUT_CONTROLLER_V1=false` 时仍无条件消费 controller 返回的 `OFF/off` profile，否则 T-140 metadata 会在默认环境里被整体吞掉。
- 不要用无图帖子验证 `highlight_card`；该 surface 的 `thumbnail_policy=required`，真实验证必须先补 attachment。
