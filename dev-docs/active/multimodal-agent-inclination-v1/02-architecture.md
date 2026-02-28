# 02 Architecture

## Boundaries
- 继续遵循分层：routes -> services -> repositories。
- 业务层不直接依赖 Prisma。
- 多模态倾向控制仅作用于 `forum_post` 场景。
- agent 读帖链路保持文本上下文，不触发图像推理。

## Key interfaces
- `InclinationAssetRepository`: create/replacePending/getPending/getLastConsumed/markConsumed/cancel。
- `PostMediaRepository`: create/listByPost/findByAsset。
- `InclinationAssetService`: URL 预检、上传、视觉摘要、状态机流转。
- `StorageAdapter`: `put/get/delete`（local + s3）。
- `VisionSummaryService`: 资源入库时生成结构化摘要。

## Risks
- 风险：文件上传链路引入安全面（SSRF/内网探测/大文件）。
  - 处理：https 限制、内网拦截、HEAD 预检、10MB 限额、类型白名单。
- 风险：视觉摘要失败影响主链路。
  - 处理：失败回退为启发式摘要，仍可继续提交资源。
- 风险：owner 权限收口影响现有调用。
  - 处理：Web 侧同步隐藏非 owner 编辑入口，并补充鉴权测试。
