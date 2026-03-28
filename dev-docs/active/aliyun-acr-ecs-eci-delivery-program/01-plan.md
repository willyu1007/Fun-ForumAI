# 01 Plan

## Phases

1. Phase A: 建立 `T-128` 到 `T-131` 任务包并同步 project governance。`[in-progress]`
2. Phase B: 冻结 `T-129` 的 GitHub Actions -> ACR 镜像发布实施方案。`[pending]`
3. Phase C: 冻结 `T-130` 的 ECS web Compose 交付与回滚方案。`[pending]`
4. Phase D: 冻结 `T-131` 的 ECI worker 交付与运行时边界。`[pending]`
5. Phase E: 汇总全链路验收矩阵、配置来源、迁移时序与 handoff 说明。`[pending]`

## Detailed Steps

- 新建四个任务目录、`.ai-task.yaml` 与完整 bundle 文件集合。
- 让 `T-128` 作为 parent narrative，承接全链路目标、固定决策、依赖顺序和最终验收。
- 让 `T-129` 明确镜像产物契约、ACR 命名与 tag、build-once-promote-many、Runner 网络形态、CI push 凭据与 Variables / Secrets 清单。
- 让 `T-130` 明确 ECS 宿主机形态、目录布局、共享反向代理、loopback upstream、运行时配置来源、ACR pull 认证、数据库迁移时序与发布/回滚步骤。
- 让 `T-131` 明确 ECI worker 的角色开关、最小环境变量矩阵、ACR pull 认证、替换式发布、健康探针和失败回退。
- 在 `T-128` 与 `T-130/T-131` 同步冻结第一阶段部署触发模型：
  - GitHub Actions 只负责构建和推送镜像
  - `staging` / `prod` 发布由运维或发布人手动执行
  - 自动化部署控制面不在本轮范围
- 在 `T-128` 固化跨任务编排顺序：
  - 镜像发布
  - 环境配置校验
  - `pnpm db:migrate:deploy`
  - ECS web
  - health/smoke
  - ECI worker
  - runtime/queue 验证
  - 人工晋升到下一环境
- 在 `T-128` 与 `T-130` 冻结 prod 多 ECS 的额外前提：
  - `SSE_BROADCAST_BACKEND=redis`
  - `SSE_REDIS_URL` 可用
  - ALB/Caddy 支持长连接与 SSE 流式转发
- 在 `T-128` 与 `T-130/T-131` 冻结数据库回滚前提：
  - 应用镜像回滚默认不回退 schema
  - migration 必须满足至少一个版本窗口的向后兼容，或显式准备 DB 回退方案
- 运行 governance `sync`、`lint` 与任务查询，把执行结果记录到 `04-verification.md`。
