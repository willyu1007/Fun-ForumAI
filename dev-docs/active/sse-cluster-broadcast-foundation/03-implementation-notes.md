# 03 Implementation Notes

## Status
- Current status: `in-progress`
- Last updated: 2026-02-25

## What changed
- 完成 SSE cluster foundation 的后端实现（保持 SSE API 不变）：
  - 引入广播抽象契约：`SseBroadcastAdapter` / `SseBroadcastEnvelope`
  - 新增 adapter：
    - `LocalSseBroadcastAdapter`（默认）
    - `RedisPubSubSseBroadcastAdapter`（cluster fanout）
  - `SseHub` 改为：
    - 本地投递与外部广播解耦
    - 支持 `setBroadcastAdapter()` 动态挂接
    - 全局/房间事件都可发布到 cluster，并过滤自身回环消息
    - 暴露广播统计：backend/published/received/dropped/last_error
- 配置与容器接线完成：
  - `config.sse` 新增 backend/channel/redis url/connect timeout
  - `container.ts` 按配置初始化 local/redis adapter，失败自动回退 local
  - 生命周期关闭时正确释放 hub + redis pub/sub 连接
- 路由观测增强：
  - `/v1/events/stats` 与 `/v1/admin/runtime/stats` 都改为输出 `sseHub.getStats()`。
- 新增单测：
  - `src/backend/sse/__tests__/hub.test.ts`
  - 覆盖本地广播、房间订阅、跨实例 fanout、去重（防本实例重复投递）。

## Files/modules touched (high level)
- `src/backend/sse/`
- `src/backend/routes/sse.ts`
- `src/backend/routes/control-plane.ts`
- `src/backend/container.ts`
- `src/backend/lib/config.ts`
- `env/`

## Decisions & tradeoffs
- Decision:
  - 保持 SSE 对外契约不变，内部改为 local/redis 可切换广播链路。
  - Redis 不可用时 fail-open 回退 local，避免阻塞主流程。
  - Rationale:
    - 最小化前端迁移成本，先解决多实例广播正确性。
    - 将 broker 作为增强层，不把 SSE 基础可用性绑定到 broker 强依赖。
  - Alternatives considered:
    - 立即全量切换 WebSocket（当前阶段收益不足）。
    - 直接在 `SseHub` 内硬编码 Redis（放弃：耦合高、测试困难）。

## Deviations from plan
- Change:
  - 本轮未改动前端 `use-sse.ts` 重连策略，仅先完成后端 cluster 广播基础。
  - Why:
    - 先收敛跨实例正确性，再做客户端容错细化可降低联调复杂度。
  - Impact:
    - 前端兼容性风险低；后续仍需补充客户端侧可观测增强和 staging 演练。

## Known issues / follow-ups
- 需与 T-023/T-024 对齐灰度顺序，避免并发改造冲突。
- 真实 staging 仍未验证（当前机器无 kube context），需在可用 staging 环境执行跨实例 smoke。
- 需补充 WebSocket 迁移触发门槛文档（与监控指标绑定）。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
