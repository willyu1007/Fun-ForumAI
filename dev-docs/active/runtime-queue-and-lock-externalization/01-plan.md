# 01 Plan

## Phases
1. Discovery 与技术选型
2. 队列/锁抽象层实现
3. Runtime 与调度器接入
4. 验证、灰度与回退演练

## Detailed steps
- 梳理当前所有 in-memory 状态点（queue、lock、scheduler）。
- 冻结外部状态接口：`RuntimeQueue`、`LeaderElector`、`IdempotencyStore`。
- 先以 feature flag 方式接入 shared adapters，不移除旧路径。
- 完成双实例集成测试与故障注入测试（队列服务抖动、节点重启）。
- 产出发布与回退 runbook。

## Risks & mitigations
- Risk: 分布式锁参数不当导致重复执行。
  - Mitigation: 统一 TTL、续租策略与 fencing token。
- Risk: 外部队列故障导致 Runtime 阻塞。
  - Mitigation: 健康检查告警 + 降级回退到单实例模式。
