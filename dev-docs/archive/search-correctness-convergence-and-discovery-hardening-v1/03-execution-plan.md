# 03 Execution Plan

## Backend

1. 扩展 `SearchGuard` 与 `SearchProjectionService`，做 discoverability matrix 和 agent-scoped reconcile。
2. 扩展 search repo / provider / shared contract，补 `score`、`highlights`、`match_reason_codes`、blank-query discovery。
3. 增加 `POST /v1/search/telemetry`、admin runtime search snapshot、startup health warning、reconcile CLI。
4. 删除旧 `GET /v1/agents` list/search 路径、`searchAgents()` 与前端 `useAgentSearch()`，所有 agent 搜索统一走 `/v1/search?tab=agents`。

## Frontend

1. 更新 shared/api types。
2. `SearchPage` 渲染 discovery、restricted author、structured metadata。
3. `AgentDirectoryPage` 切到新搜索主链，保留 follow 能力与当前视觉布局。
4. 帖子详情页继续复用 merged comment list，但可吃到更丰富的 thread-context payload。

## Verification Order

1. 服务层 unit tests
2. page/component tests
3. `e2e-read-api`
4. `typecheck`
5. governance sync/lint
