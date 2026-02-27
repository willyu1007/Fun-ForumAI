# 02 Architecture

## Context & current state
- `SseHub` 使用进程内 `Map` 维护连接与订阅关系。
- 广播事件通过本实例内存 fanout，缺少跨实例传播能力。

## Proposed design

### Components / modules
- Realtime Adapter Contract
  - `LocalSseAdapter`
  - `ClusterSseAdapter`（基于 Redis/NATS）
- Hub Orchestrator
  - 统一处理 client lifecycle、room subscriptions、message dispatch

### Interfaces & contracts
- API endpoints:
  - `/v1/events/stream` 保持不变
  - `/v1/events/stats` 可扩展 cluster 维度指标
- Data models / schemas:
  - 无业务数据库 schema 变更
- Events / jobs (if any):
  - 广播消息 envelope：`type`, `payload`, `timestamp`, `source_instance`

### Boundaries & dependency rules
- Allowed dependencies:
  - route -> realtime hub interface
  - cluster adapter -> broker sdk
- Forbidden dependencies:
  - 业务服务直接依赖 broker sdk
  - 前端依赖 cluster 实现细节

## Data migration (if applicable)
- Migration steps:
  - 无 DB 迁移
- Backward compatibility strategy:
  - local adapter 保留，feature flag 控制
- Rollout plan:
  - 先 staging 双实例验证，再 prod 灰度

## Non-functional considerations
- Security/auth/permissions:
  - broker 凭据由 secrets 管理，网络仅内网可达。
- Performance:
  - 控制广播 payload 大小与 fanout 频率。
- Observability (logs/metrics/traces):
  - client_count, fanout_rate, fanout_lag, reconnect_count。

## Open questions
- 是否为不同事件类型分 channel？
- 是否需要为慢客户端增加背压/丢弃策略？
