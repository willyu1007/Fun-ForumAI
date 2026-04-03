# 00 Overview — aliyun-acr-ecs-eci-delivery-program (T-128)

## Status

- State: in-progress
- Phase: Phase B — 子任务重排与全链路交接
- Current status: `T-128` 已从原来的 “T-129~T-131 三子任务” 扩展为五包编排入口：既保留 `T-129/T-130/T-131` 的历史交付基线，也新增 `T-935`（云环境全链路）与 `T-936`（runtime cutover/staging close-out）承接超出旧边界的工作。`T-130` 的 repo 侧 `vm/compose` 交付已存在；`T-129` 仍因 ACR `TagImmutability=true` 与 mutable alias 冲突保持 `blocked`。
- Current environment: 当前 repo 已明确 `ECS web + ECI worker` 目标拓扑，但真实云环境 readiness、ALB / DNS / SSL / ICP / Redis / RDS / 对象存储闭环由 `T-935` 承接。
- Coverage review: 对照 `/Users/phoenix/Downloads/llm_runtime_routing_and_injection_design.md` 后，当前三包可以覆盖目标，但需显式补入四个缺口：
  - `T-901` 补 modality / response mode / adapter capability / provider.auth metadata-only / policy merge precedence
  - `T-935` 补 staging/prod policy-only cloud routing、workload secret coverage review gate、以及 stack handoff
  - `T-936` 补 callsite parameter migration inventory、execution trace persistence、promote gate review
  - 需求文档中 “接入 visibleProviderPin” 已被当前方案替换为“移除 visible pins 主路径语义”，必须在任务合同中显式标记为 superseded 决策

## Goal

形成一套面向阿里云的可实施交付链任务包，统一以下决策并为后续实施提供单一叙事入口，同时把超出旧交付边界的云环境与 runtime close-out 工作分配给独立任务包：

- `GitHub Actions -> ACR -> ECS(web) + ECI(worker)`
- 单镜像多角色：`RUNTIME_ENABLED=false/true`
- 单次构建、多环境晋升：同一镜像从 `staging` 推进到 `prod`
- 环境范围限定为 `staging + prod`
- 区域固定为 `cn-hangzhou`
- ECS 采用 `Docker Engine + Docker Compose`

## Non-goals

- `T-128` 本身不直接执行真实云资源 apply，也不在本文件内承载所有云环境细节。
- 本轮不引入 ACK、Kubernetes、k3s 或其他集群编排层。
- runtime execution-plan / observability cutover 的具体实现不在 `T-128` 内完成，由 `T-901/T-936` 承接。

## Context

- 仓库已有 CI 基线、服务 Dockerfile、packaging/deploy 目录与环境契约，但没有阿里云 ACR/ECS/ECI 的明确交付任务包。
- 运行时代码已支持 `RUNTIME_ENABLED` 控制后台服务是否自启，因此 web 与 worker 可以先复用同一镜像。
- README 已明确部署环境应使用 `pnpm db:migrate:deploy`，所以数据库迁移归属必须进入交付链设计。
- `env/contract.yaml` 与 `docs/env.md` 已定义运行时变量契约，因此 CI 配置、宿主机 `.env` 与 ECI 注入边界必须被明确分离。
- 用户已明确接受 ACR 先行方案，并确认短期不采用 ACK。

## Acceptance Criteria

- [ ] `T-128`、`T-129`、`T-130`、`T-131`、`T-901`、`T-935`、`T-936` 的治理边界清晰且已同步 project hub。
- [ ] 总任务清晰覆盖全链路目标、依赖、回滚、最终验收与环境晋升顺序。
- [ ] 子任务分别清晰覆盖 ACR 发布、ECS web、ECI worker 基线、云环境全链路、runtime cutover 五条执行线。
- [ ] 文档明确 build-once-promote-many、数据库迁移时序、运行时配置来源与 ACR pull 认证。
- [ ] 文档明确第一阶段由运维/发布人手动触发 ECS/ECI 发布，GitHub Actions 仅负责 build/push。
- [ ] 文档明确 prod 多 ECS 场景必须启用 Redis SSE 广播，并要求入口层支持长连接。
- [ ] 文档明确“镜像 tag 回滚”仅在数据库迁移保持向后兼容时成立；否则必须附带显式 DB 回退方案。
- [ ] 文档明确 `api -> envfile`、`worker -> aliyun-eci-container-group` 的 secret injection 边界。
- [ ] 文档明确 `LLM_PROVIDER / LLM_MODEL / LLM_BASE_URL` 已从 repo cloud contract 中移除，不能再作为 staging/prod 的环境级路由控制面。
- [ ] 文档明确需求文档中的核心章节已映射到 `T-901/T-935/T-936`，且不存在无人承接的 high-signal gap。
- [ ] 每个任务包在进入下一包前都有显式 review gate 和收口条件。
- [ ] 文档内不存在影响后续实施的高影响未决决策。
