# 03 Implementation Notes — realtime-protocol-evaluation (T-033)

## Status
- Current status: done
- Last updated: 2026-02-26

## 1. 当前 SSE 使用模式分析

### 后端架构
- **SseHub** (`src/backend/sse/hub.ts`): 单例实例，管理所有 SSE 连接
- **三种广播范围**: `global`（全局）、`room`（房间级）、`session`（私聊会话级）
- **心跳**: 30s 间隔，5 分钟超时自动清理
- **集群支持**: `SseBroadcastAdapter` 接口已预留（支持 Redis pub/sub，T-025 完成）

### 前端消费者（Web）
| Consumer | 订阅类型 | 事件类型 | 备注 |
|----------|---------|---------|------|
| `useSseAutoRefresh` | global | POST_CREATED, COMMENT_CREATED, VOTE_UPSERTED | 全局 feed 刷新 |
| `useChatRoomSse` | room | MESSAGE_CREATED, MEMBER_JOINED/LEFT, STATUS_CHANGED, TYPING | 聊天室实时 |
| `usePrivateSessionSse` | session | PRIVATE_MESSAGE_CREATED, PRIVATE_SESSION_ENDED | 私聊 |

### 移动端消费者
| Consumer | 订阅类型 | 事件类型 |
|----------|---------|---------|
| `openSseStream` (rooms) | room | MESSAGE_CREATED, MEMBER_JOINED/LEFT |
| `openSseStream` (sessions) | session | PRIVATE_MESSAGE_CREATED, PRIVATE_SESSION_ENDED |

### 连接数预估
- 每个 Web 页面最多 2 个 SSE 连接（1 global + 1 scoped）
- 每个移动端 1-2 个连接
- 当前阶段：预计 < 100 并发连接

### 事件频率
- 帖子/评论/投票：低频（秒级到分钟级）
- 聊天消息：中频（Agent 响应 1-5s 延迟）
- Typing 指示：高频（但仅在聊天室活跃时）
- 心跳：固定 30s 间隔

## 2. WebSocket 引入的收益/成本评估

### 收益
| 项目 | 详情 |
|------|------|
| 双向通信 | 客户端可直接通过 WS 发送消息，减少 HTTP 请求 |
| 低延迟 | 无 HTTP 握手开销，适合高频交互（typing、实时编辑） |
| 连接效率 | 单连接即可双向，减少连接数 |
| 协议原生支持 | 移动端 `react-native` 内置 WebSocket，无需额外库 |
| 断线重连 | 可在协议层实现更精细的重连策略 |

### 成本
| 项目 | 详情 |
|------|------|
| 后端重构 | 需新建 WS 服务器（ws / socket.io），重写 SseHub 为 WsHub |
| 负载均衡 | WS 需要 sticky sessions 或独立的 WS 网关 |
| 认证 | WS 握手时鉴权，而非每次 HTTP 请求 |
| 前端重构 | 3 个 Web hook + 1 个 Mobile client 需改写 |
| 测试 | 需新建 WS 集成测试 |
| 代理兼容 | 某些企业代理/CDN 对 WS 支持不如 SSE |
| 开发时间 | 估计 2-3 个完整任务周期 |

## 3. 混合方案可行性

### 方案 A: 继续纯 SSE（推荐）
- **理由**:
  1. 当前规模（< 100 连接）SSE 完全足够
  2. 所有场景均为服务端推送（server → client），无客户端主动推送需求
  3. 聊天消息通过 REST API 发送，SSE 仅做通知触发 cache invalidation
  4. SSE 对代理/CDN 友好，部署简单
  5. 集群广播已通过 Redis pub/sub 解决（T-025）
- **迁移时机**: 当出现以下情况时重新评估
  - 并发连接 > 1000
  - 需要客户端主动推送（如实时协作编辑）
  - Typing 指示需要更低延迟（当前通过 REST 实现足够）

### 方案 B: SSE + WS 混合
- SSE 保留用于低频 global 事件
- WS 用于高频场景（聊天室 typing、私聊消息流）
- **问题**: 两套连接管理增加复杂度，不建议在当前规模下采用

### 方案 C: 全量迁移 WS
- 适用于大规模、双向交互密集场景
- 当前需求不匹配此方案

## 4. 决策

**决策：继续使用 SSE（方案 A）**

### 理由
1. **需求匹配**: 所有实时场景均为 server → client 单向推送
2. **规模适配**: 当前及近期预估连接数远低于 SSE 瓶颈
3. **基础设施已就位**: SseHub + Redis broadcast adapter + 心跳 + 超时清理均已完备
4. **韧性已增强**: T-032 完成后，Web 和 Mobile 的 SSE 客户端均具备连接状态追踪、重连限制、事件类型守卫
5. **投入产出**: WS 迁移需 2-3 个任务周期，但收益有限

### 迁移触发条件
- 并发 SSE 连接 > 1000 且观测到性能瓶颈
- 产品需求引入客户端主动推送场景
- 移动端 SSE 在弱网环境下表现不可接受

## 5. 迁移路径概要（备用）

如未来决策迁移：
1. 新建 `WsHub` 实现同样的 `global | room | session` 广播语义
2. WS 握手时通过 query param 或首消息传递 JWT token
3. 保留 `SseBroadcastAdapter` 接口，WsHub 复用同一 Redis pub/sub 通道
4. 前端新建 `useWs*` 系列 hook，逐模块替换
5. 移动端替换 `react-native-sse` 为原生 `WebSocket`
6. 灰度切换：通过 feature flag 控制 SSE/WS 选择
