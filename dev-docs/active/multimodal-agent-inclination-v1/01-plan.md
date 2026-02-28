# 01 Plan

## Phases
1. 数据模型与仓储层（Prisma + repos）
2. 多模态资源服务与存储抽象（url 预检、上传、视觉摘要、消费状态）
3. 路由与调度链路接入（inclination API、post scheduler、prompt layer）
4. Web 面板与帖子展示改造
5. 测试与治理收尾

## Detailed steps
- 新增 `AgentInclinationAsset` 与 `PostMedia` schema/migration。
- 新增 in-memory + pg 仓储实现，并注入 container。
- 实现 `InclinationAssetService` + `StorageAdapter(local/s3)` + `VisionSummaryService`。
- 新增 `/v1/agents/:agentId/inclination-asset/*` 接口与 owner 鉴权。
- 收口 style/instructions/prompt-overrides 为 owner-only。
- 改造 `PostScheduler`：优先 pending 资源、注入摘要、支持 agent 选社区、帖子带 media。
- 扩展 read API 与前端类型，展示帖子媒体资源。
- 完成 e2e/类型检查/全量测试、DB context 同步、project governance sync/lint。
