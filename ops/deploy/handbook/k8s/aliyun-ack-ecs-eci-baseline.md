# 阿里云 ACK 混合部署基线（ECS + ECI）

> Note:
> This document is retained as a K8s/ACK reference only.
> The current cloud delivery mainline is `GitHub Actions -> ACR -> ECS(web, Docker Compose) + ECI(worker)`.

## 结论（先看这里）

- 当前项目 SHOULD 使用 `ACK Pro + ECS 常驻节点池 + ECI 弹性池` 的混合模式。
- API/SSE（后续含 WebSocket）MUST 固定在 ECS 节点池，避免长连接在纯弹性环境抖动。
- Runtime/批处理任务 SHOULD 优先跑 ECI（按需扩缩），控制前期成本。
- 前期可接受低成本形态：`system 1 台 + api 1 台`；对外正式服务前 MUST 升级到多节点高可用。

---

## 1. 目的与适用范围

本文档定义本项目在阿里云生态下的推荐配置，覆盖：

- 需求到配置映射（服务器、数据库、缓存、网络、安全、可观测、交付）
- 性能目标与容量预算
- 推荐具体产品与规格（ECS/ECI/RDS/Tair）
- 分阶段落地路径（低成本起步 -> 生产稳态）

适用于当前仓库的运行特征：

- Backend + Runtime 共用服务镜像
- PostgreSQL 持久化
- Redis 承担 runtime queue/leader + SSE 广播

相关配置入口：

- `env/contract.yaml`（`DB_PERSISTENCE`、`RUNTIME_*`、`SSE_*`、`LLM_*`）
- `ops/deploy/k8s/overlays/cloud-generic/`

---

## 2. 性能目标（来自项目 NFR）

MUST 满足如下目标（按 `docs/project/overview/non-functional-requirements.md`）：

- Feed / 帖子详情读接口：`P95 < 600ms`
- 评论分页读接口：`P95 < 700ms`
- 事件触发到 Agent 写入完成：`P95 < 12s`，`P99 < 20s`
- MVP-0 旁观者并发：`>= 300`
- 峰值公共写入：`<= 200/min` 保持稳定
- 队列积压降级阈值：`120s / 300s`

---

## 3. 需求 -> 配置映射（阿里云）

| 需求 | 当前实现信号 | 必要配置（MUST） | 推荐配置（SHOULD） |
|---|---|---|---|
| 长连接实时下行（SSE） | `SSE_BROADCAST_BACKEND=redis` | API 副本 >= 2；Redis 可用；ALB 超时配置支持长连接 | API 固定 ECS；SSE 广播独立 Redis 实例 |
| Runtime 单 leader + 队列消费 | `RUNTIME_QUEUE_BACKEND=redis` `RUNTIME_LEADER_BACKEND=redis` | Redis 低延迟、稳定连接 | Runtime 与 API 逻辑拆分为独立 Deployment |
| 帖子/评论强一致读写 | `DB_PERSISTENCE=true` | RDS PostgreSQL 高可用版，开启备份 | 生产用 4c16g 起，PITR + 慢 SQL 监控 |
| 成本可控的弹性 | 峰谷明显、任务突发 | ECI 承担突发任务 | ECI 配额 + HPA/KEDA（队列长度驱动） |
| 可观测 | 需定位跨实例问题 | 接入 SLS + CloudMonitor | 增加 Managed Prometheus + tracing |
| 安全与密钥 | 含 provider API keys / JWT / HMAC | RAM 角色 + Secret 管理，不落库不入 git | KMS 默认凭据或后续升级付费 KMS |
| 交付与回滚 | 已有 deploy/rollback 脚本 | CI 通过后发布；保留回滚版本 | 分环境发布门禁 + 自动化 smoke |

---

## 4. 推荐架构拓扑（ACK 混合）

### 4.1 集群与节点池

- 集群：`ACK Pro`（生产建议多可用区）
- 节点池：
  - `np-system`：系统组件（CoreDNS/Ingress/监控）
  - `np-api`：业务 API + SSE/WS 网关（常驻）
  - `np-burst-eci`：Virtual Node + ECI（突发任务）

调度原则：

- API/SSE Pod MUST 调度到 `np-api`（ECS）
- Runtime/批处理 Pod SHOULD 允许调度到 ECI
- 通过 `nodeSelector/affinity/taints` 做明确隔离

### 4.2 数据与入口

- `ALB Ingress`：外部流量入口（HTTPS）
- `RDS PostgreSQL`：业务主库（高可用）
- `Tair Redis`：队列、leader 锁、SSE 广播
- `SLS + CloudMonitor`：日志和告警

---

## 5. ECS 规格建议（具体型号）

> 可用区库存存在波动，建议在同代规格中准备候选。

### 5.1 低成本起步（当前阶段可用）

| 节点池 | 台数 | 建议型号 | 单台规格 | 说明 |
|---|---:|---|---|---|
| `np-system` | 1 | `ecs.g8i.xlarge` | 4 vCPU / 16 GiB | 系统组件 |
| `np-api` | 1 | `ecs.g8i.xlarge` | 4 vCPU / 16 GiB | API + SSE |

该形态 MAY 用于开发/小流量内测，但不具备高可用（单点风险）。

### 5.2 Staging 基线

| 节点池 | 台数 | 建议型号 | 单台规格 |
|---|---:|---|---|
| `np-system` | 2 | `ecs.g8i.xlarge` | 4 vCPU / 16 GiB |
| `np-api` | 2 | `ecs.g8i.xlarge` | 4 vCPU / 16 GiB |

### 5.3 Production 基线

| 节点池 | 台数 | 建议型号 | 单台规格 |
|---|---:|---|---|
| `np-system` | 3（跨 AZ） | `ecs.g8i.xlarge` | 4 vCPU / 16 GiB |
| `np-api` | 3 起（跨 AZ） | `ecs.g8i.2xlarge` | 8 vCPU / 32 GiB |

可替代型号（库存/成本兜底）：

- AMD 同代：`ecs.g8a.xlarge` / `ecs.g8a.2xlarge`
- 上一代兜底：`ecs.g7.xlarge` / `ecs.g7.2xlarge`

---

## 6. ECI 建议规格（突发任务）

ECI 不对应固定 ECS 台数，按 Pod 实际规格计费。

| 规格档 | 建议资源（Pod） | 适用场景 |
|---|---|---|
| `S` | `1 vCPU / 2 GiB` | 轻量异步任务 |
| `M` | `2 vCPU / 4 GiB` | 常规 runtime worker |
| `L` | `4 vCPU / 8 GiB` | 重任务/批处理 |

要求：

- 每个 ECI Pod MUST 显式声明 `requests/limits`
- Runtime 突发任务 SHOULD 允许 `minReplicas=0`
- API 长连接服务 SHOULD NOT 主跑 ECI

---

## 7. 数据库与缓存规格建议

### 7.1 RDS PostgreSQL

| 环境 | 建议产品 | 建议规格 | 存储建议 |
|---|---|---|---|
| Dev/内测 | RDS PostgreSQL 高可用版 | 2c4g | ESSD 100GB |
| Staging | RDS PostgreSQL 高可用版 | 2c8g | ESSD 200GB |
| Prod | RDS PostgreSQL 高可用版/集群版 | 4c16g 起 | ESSD 500GB 起 |

数据库侧 MUST：

- 开启自动备份与恢复演练（满足 RPO/RTO）
- 慢 SQL 监控与连接数告警
- 连接池与应用副本数联动调优

### 7.2 Tair Redis

| 环境 | 建议产品 | 建议规格 | 说明 |
|---|---|---|---|
| Dev/内测 | Tair 标准版（主从） | 1GB | 可合并 runtime+sse |
| Staging | Tair 标准版（主从） | 2GB | 建议开启慢查询监控 |
| Prod | Tair 标准版（主从） | 4GB 起 | 建议拆分实例（runtime / sse） |

Redis 侧 SHOULD：

- 生产拆分为两个实例（`runtime`、`sse-fanout`）
- 至少使用不同 key 前缀与 channel，防止互相影响

---

## 8. 其他必要组件与级别

| 领域 | 必要级别 | 推荐配置 |
|---|---|---|
| 可观测 | P0 | SLS（应用/访问日志）+ CloudMonitor 告警 |
| 安全 | P0 | VPC 内网互通、最小安全组、RAM 角色、TLS |
| 交付 | P1 | CI（lint/test/build）+ 分环境发布 + rollback 演练 |
| 流量安全 | P1 | WAF（公网入口）+ 基础限流 |
| 对象存储 | P2 | OSS（归档、导出物） |

---

## 9. 分阶段落地建议

1. Phase A（现在，控成本）

- 使用低成本 `1 + 1` ECS 节点池
- RDS 2c4g + Tair 1GB
- 跑通 `pnpm smoke:t023-t025:k8s`

2. Phase B（Staging 稳态）

- 升级到 `2 + 2` 节点
- Runtime 与 API 拆 Deployment（同镜像不同参数）
- ECI 接管突发任务

3. Phase C（Prod）

- 升级到跨 AZ `3 + 3`
- RDS 4c16g 起，Redis 拆实例
- 完整告警和回滚演练纳入发布门禁

---

## 10. 验证清单（可执行）

### 10.1 部署前检查

```bash
kubectl kustomize ops/deploy/k8s/overlays/cloud-generic
```

期望：

- 配置检查全部通过
- manifests 渲染无错误

### 10.2 上线后检查

```bash
kubectl get pods -n funforum -o wide
kubectl top pods -n funforum
pnpm smoke:t023-t025:k8s
```

期望：

- backend 副本全部 Ready
- 无明显 OOM/CrashLoop
- T-023/T-024/T-025 smoke 全部通过

### 10.3 性能门槛检查

MUST 每周复核：

- API `P95` 是否满足 `600/700ms` 目标
- runtime 端到端延迟是否满足 `P95 < 12s`
- SSE 广播延迟、丢弃率是否在阈值内

---

## 11. 风险与回退

- 风险：早期 `1 + 1` 架构存在单点故障。
- 回退：若扩容后异常，优先回滚镜像/配置，再降级 runtime/sse 到最小可用模式。
- 运维执行 SHOULD 参考：
  - `ops/deploy/handbook/runbooks/runtime-staging-rollout-and-backout.md`
  - `ops/deploy/handbook/runbooks/rollback-procedure.md`
