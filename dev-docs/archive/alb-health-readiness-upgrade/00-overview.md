# 00 Overview — alb-health-readiness-upgrade (T-929)

## Status

- State: done
- Depends on: `T-128 aliyun-acr-ecs-eci-delivery-program`, `T-130 ecs-web-compose-delivery`
- Next step: 仓库内代码与文档工作已完成；目标环境的 `SSE_BROADCAST_BACKEND` / Redis 配置复核与 ALB smoke 由部署执行侧继续完成。

## Goal

把 backend 的健康检查语义收口为面向 ALB 的稳定契约，使 Web/API/SSE 节点在接入阿里云 ALB 后，能够基于应用启动、数据库连通性、Redis 连通性和节点摘流状态准确地被判定为可接流量或不可接流量。

## Non-goals

- 不改 worker / runtime 节点的健康语义。
- 不引入外部依赖探测（LLM、OSS、Bitwarden 等）。
- 不改 frontend 行为或 SSE 协议本身。
- 不在本任务中建设真实 ALB、ECS、Caddy 配置。

## Acceptance Criteria

- [x] 新增 `GET /livez`、`GET /readyz`，并让 `GET /health` 在当前阶段等同于 `readyz`。
- [x] `/health` 与 `/readyz` 仅使用轻量探针：应用状态、`SELECT 1`、`PING`。
- [x] 多 ECS Web 所需 Redis 不可用时，`/health` 返回 `503`，避免 ALB 继续送流量。
- [x] 健康探针结果带短 TTL 缓存，避免每次请求都打到 DB/Redis。
- [x] 进程收到停机信号后先进入 not-ready，再执行优雅关闭。
- [x] health 相关请求默认不写常规 access log，只在失败时输出简短错误信息。
- [x] 现有业务路由和 SSE 链路保持兼容。
