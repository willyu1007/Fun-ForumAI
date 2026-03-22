# 02 Architecture — T-122

## Generation Flow
1. director/planner 决定需要 generation
2. `MediaGenerationService` 创建或复用 generation job
3. `MediaGenerationGateway/Broker` 调用 provider
4. 成功时注册生成资产到 `media_assets`
5. 触发或复用 semantic snapshot
6. 编译 display / runtime projection
7. 应用到 public/private surface

## Gateway Split
- `MediaSemanticService`
  - 继续复用 `LLMGateway`
- `MediaGenerationGateway`
  - 单独处理 provider request、binary output、job polling、timeout/cancel

## Default Execution Strategy
- 主链路只允许一次短同步尝试。
- 达到硬超时后立即降级，不阻塞 public post 主链。
- 后台 job 可继续完成，但 display/runtime 必须有明确 fallback。

## Minimum Concurrency Controls
- global generation concurrency cap
- per-provider concurrency cap
- brief/recipe hash dedupe
- timeout and retry policy
- 失败与取消状态可审计

## Generation Job State Contract
- 最小状态集合：
  - `queued`
  - `running`
  - `succeeded`
  - `failed`
  - `timed_out`
  - `cancelled`
- Wave 1 默认策略：
  - 主链路只等待一次短同步尝试
  - 超时后当前写入链立即降级，不等待 late result
  - 若后台任务继续完成，生成资产仅进入未来可复用池；不在 wave 1 回写已发布 root post
