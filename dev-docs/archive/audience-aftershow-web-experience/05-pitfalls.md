# 05 Pitfalls — T-057

## do-not-repeat summary
- `FF_AUDIENCE_AFTERSHOW_WEB_V1` 关闭时，页面必须回退到旧结构，不能依赖新字段存在。
- 通知深链 target_id 解析要容错（缺少 `aftershow_id/callout_index` 时仍可回帖页）。
- hooks 默认 `retry: false` 用于 flag off 场景，避免无意义重试噪音。
