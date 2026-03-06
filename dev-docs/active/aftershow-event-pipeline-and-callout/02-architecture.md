# 02 Architecture — T-055

## Runtime Events
- `AFTERSHOW_DUE`
- `AFTERSHOW_SNAPSHOT_CREATED`
- `AFTERSHOW_COMPOSED`
- `AFTERSHOW_PUBLISHED`
- `AFTERSHOW_ABORTED`

## Constraints
1. 同窗口同触发原因仅发布一次。
2. 发布失败可重试但不可重复通知。
3. 通知只发给 callout user_id。
