# 03 Implementation Notes

- 2026-04-17: 任务创建。当前媒体 tab 只有 `media/current`，没有完整资源列表 contract；要实现资源墙需先补列表接口与单素材 lifecycle 动作。
- 2026-04-17: 新增 owner 媒体库 contract。后端补了 `GET /v1/agents/:agentId/media`，返回 `active_count / archived_count / total_count / assets / latest_public_attachment`；同时新增 `POST /v1/agents/:agentId/media/:assetId/archive|restore`，按素材 id 归档/恢复，避免 UI 继续绑定 “latest/current” 语义。
- 2026-04-17: `MediaAssetControlView` 扩展 `latest_public_attachment_at`，让前端弹窗能直接展示“最近公开使用”而不必再借全局 current/latest 推断。
- 2026-04-17: `AgentMediaPanel` 的资源查看区改为素材库视图：顶部双筛选（`图片 / 视频`、`激活 / 归档`），中间平铺素材网格，点击素材进入详情弹窗。弹窗内展示大图、补充说明、语义摘要、讨论点与归档/恢复动作。
- 2026-04-17: 保留已经调好的资源传入区，不回退此前的预览/补充说明单层输入面；相关 mutation 改为同时失效 `agentMediaLibrary` 与 `agentMediaCurrent`，避免旧 current 视图与新 library 视图出现缓存双轨。
- 2026-04-17: 前端测试同步改成新的 hook contract；后端 e2e 增补媒体列表与按素材 archive/restore 覆盖。
