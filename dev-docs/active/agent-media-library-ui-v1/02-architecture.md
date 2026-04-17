# 02 Architecture

- 读取层：
  - `GET /v1/agents/:agentId/media` 返回 owner 媒体资源列表
- 动作层：
  - `POST /v1/agents/:agentId/media/:assetId/archive`
  - `POST /v1/agents/:agentId/media/:assetId/restore`
- 前端：
  - `资源查看` 改为前端本地筛选（媒体类型、生命周期）
  - 素材详情通过 modal/dialog 展开
