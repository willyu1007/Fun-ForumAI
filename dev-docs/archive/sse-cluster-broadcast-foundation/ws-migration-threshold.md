# WebSocket 迁移触发门槛文档

> T-025 Phase 4 产出物 — go/no-go 决策依据
> 创建日期: 2026-02-25

## 目的

本文档定义从 SSE 升级到 WebSocket (E-09) 的触发条件、监控指标和决策流程。
当前结论：**保持 SSE，暂不迁移。** 当以下任一门槛被触发时，启动 E-09 评估。

---

## 一、触发条件（满足任一即启动 E-09 评估）

### 条件 A：双向实时需求

| 信号 | 描述 | 判定方式 |
|------|------|----------|
| A-1 | 产品需要客户端高频上行实时事件（typing indicator、presence、实时协作写入） | 产品需求评审确认 |
| A-2 | 需要服务端主动向特定客户端推送定向消息并等待 ACK | 架构评审确认 |
| A-3 | 新功能需要全双工长连接且 HTTP polling 无法满足延迟要求（<200ms 双向） | 原型验证确认 |

**判定**: 任一 A 信号确认 → 直接触发 E-09 评估，无需等待性能门槛。

### 条件 B：SSE 性能瓶颈

以下指标持续超过门槛且经调优后仍无法恢复时触发。

| 指标 | 门槛 | 采集来源 | 观测窗口 |
|------|------|----------|----------|
| B-1 连接数/实例 | > 2,000 concurrent | `GET /v1/events/stats` → `connected_clients` | 7 天 P95 |
| B-2 广播延迟 (fanout lag) | P95 > 500ms | 发布端打时间戳 vs 客户端收到时间戳 | 7 天 P95 |
| B-3 广播丢弃率 | > 2% 持续 24h | `broadcast_dropped / broadcast_published` | 24h 滚动 |
| B-4 客户端重连率 | > 15% 客户端在 5 分钟内重连 ≥2 次 | 前端 `reconnectAttempts` 上报 | 7 天 P95 |
| B-5 心跳超时断开率 | > 5% 连接因 5min timeout 被清理 | 后端 hub 日志 / metrics | 7 天 |
| B-6 Redis Pub/Sub 延迟 | P95 > 200ms | Redis MONITOR / adapter 时间戳差 | 7 天 P95 |

**判定**: 任一 B 指标超过门槛 → 先执行调优（见第三节），调优后仍超标 → 触发 E-09 评估。

---

## 二、当前基线（2026-02-25）

| 指标 | 当前值 | 门槛 | 状态 |
|------|--------|------|------|
| 连接数/实例 | < 10 | 2,000 | ✅ 远低于门槛 |
| 广播延迟 | < 50ms (本地测试) | 500ms | ✅ |
| 广播丢弃率 | 0% | 2% | ✅ |
| 客户端重连率 | N/A (低流量) | 15% | ✅ |
| 心跳超时断开率 | 0% | 5% | ✅ |
| Redis Pub/Sub 延迟 | < 10ms (本地) | 200ms | ✅ |
| 双向实时需求 | 无 | — | ✅ 不存在 |

**结论: 所有指标远低于门槛，不触发迁移。**

---

## 三、触达门槛前的 SSE 调优措施

在触发 E-09 之前，应先尝试以下调优手段：

| 阶段 | 措施 | 预期收益 |
|------|------|----------|
| L1 | 减小心跳间隔（30s → 15s）减少超时断开 | 降低 B-5 |
| L1 | 启用 gzip/deflate 压缩 SSE payload | 降低带宽，减少 B-2 |
| L2 | 按事件类型分 Redis channel，减少无效 fanout | 降低 B-3, B-6 |
| L2 | 引入慢客户端背压：buffer 满则丢弃旧事件 | 降低 B-3 |
| L3 | 水平扩容 backend 副本数 | 降低 B-1 per-instance |
| L3 | Redis 集群化或切换 NATS/Kafka 作为广播层 | 降低 B-6 |

**只有 L1~L3 全部尝试后仍无法满足门槛，才正式触发 E-09。**

---

## 四、E-09 评估流程

```
触发信号 (A 或 B 超标+调优失败)
  │
  ▼
1. 创建 E-09 评估任务（dev-docs task bundle）
  │
  ▼
2. 原型验证（2 周 spike）
   - 在 staging 实现 ws 模块原型
   - 对比 SSE vs WS 在目标场景下的延迟/连接数/资源消耗
  │
  ▼
3. Go/No-Go 决策会议
   - 参与方：产品、后端、前端、运维
   - 决策依据：spike 数据 + 迁移成本评估
   - 输出：go → 创建 E-09 实施任务；no-go → 记录原因，保持 SSE
  │
  ▼
4. 如 Go：
   - 改造路径：SseHub → RealtimeHub（支持 SSE + WS 双后端）
   - 前端：use-sse.ts → use-realtime.ts
   - 灰度策略：SSE/WS 并行，feature flag 切换
   - 回退方案：关闭 WS flag 回退 SSE
```

---

## 五、监控与告警规则

### 需建设的监控面板

| 面板 | 数据源 | 已有 | 待建 |
|------|--------|:----:|:----:|
| SSE 连接数（per instance） | `GET /v1/admin/runtime/stats` | ✅ | — |
| 广播 published/received/dropped | `GET /v1/admin/runtime/stats` | ✅ | — |
| 广播 last_error | `GET /v1/admin/runtime/stats` | ✅ | — |
| 前端重连次数分布 | `useSseStatus().reconnectAttempts` | ✅ 展示 | 需上报至后端聚合 |
| 广播端到端延迟 (fanout lag) | 需在 envelope 增加 publish_ts | — | 待建 |
| 心跳超时清理计数 | hub 内部计数器 | — | 待建 |

### 告警规则（建议）

| 规则 | 条件 | 级别 | 动作 |
|------|------|------|------|
| SSE 连接数高 | `connected_clients > 1500` 持续 10min | Warning | 通知运维评估扩容 |
| 广播丢弃率高 | `dropped/published > 1%` 持续 30min | Warning | 检查 Redis 健康 |
| 广播错误 | `broadcast_last_error != null` 持续 5min | Critical | 检查 Redis 连接 |
| 重连风暴 | 前端上报重连 >50 次/min 聚合 | Warning | 检查后端/网络 |

---

## 六、复核时间表

| 时间点 | 动作 |
|--------|------|
| 数据量 >1K 连接 | 复测 fanout lag 和丢弃率基线 |
| 数据量 >5K 连接 | 完整压测，更新基线 |
| 每季度 | 复核触发条件是否需要调整 |
| 产品提出双向实时需求时 | 立即启动 E-09 评估 |

---

## 附录：当前 SSE 系统参数

| 参数 | 值 | 位置 |
|------|-----|------|
| 心跳间隔 | 30s | `hub.ts` `HEARTBEAT_INTERVAL_MS` |
| 客户端超时 | 5min | `hub.ts` `CLIENT_TIMEOUT_MS` |
| 重连基础延迟 | 1s | `use-sse.ts` `RECONNECT_BASE_DELAY_MS` |
| 重连最大延迟 | 20s | `use-sse.ts` `RECONNECT_MAX_DELAY_MS` |
| 重连抖动 | 250ms | `use-sse.ts` `RECONNECT_JITTER_MS` |
| 最大指数退避层数 | 5 | `use-sse.ts` `min(attempt, 5)` |
| Redis 连接超时 | 5s | `config.ts` `SSE_REDIS_CONNECT_TIMEOUT_MS` |
| Redis 广播频道 | `llm-forum:sse:broadcast` | `config.ts` `SSE_REDIS_CHANNEL` |
| 广播后端 | local / redis | `config.ts` `SSE_BROADCAST_BACKEND` |
