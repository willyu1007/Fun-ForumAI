# 00 Overview — aliyun-acr-ecs-eci-delivery-program (T-128)

## Status

- State: in-progress
- Phase: Phase B — 子任务重排与全链路交接
- Current status: `T-128` 已从原来的 “T-129~T-131 三子任务” 扩展为五包编排入口：既保留 `T-129/T-130/T-131` 的历史交付基线，也新增 `T-935`（云环境全链路）与 `T-936`（runtime cutover/staging close-out）承接超出旧边界的工作。当前 repo 侧主线已推进到：`T-901` 把 execution-plan contract、candidate capability/pricing coverage、以及 explicit modality/response-mode contract 一并加硬；`T-935` 把 `api -> envfile`、`worker -> aliyun-eci-container-group` 固化为唯一云注入边界；`T-936` 则把 override evidence 收口到 recent ledger + process env，并已在 kind-staging 上跑通 `verify:launch:staging` 与 `verify:runtime:closeout:staging`。截至 2026-04-07，repo 侧 `pnpm verify:launch` 与 deployment metadata verify 已恢复全绿，staging desired release 也已记录为 fulfilled；当前剩余待收口项不再是 repo gate，而是外部执行与配置输入：prod desired release 尚未建立，staging SMS 配置已就绪，但 SMTP 仍存在 `talkshow-stag/smtp_user` / `talkshow-stag/smtp_pass` secret drift。
- Current environment: 当前 repo 已明确 `ECS web + ECI worker` 目标拓扑，但真实云环境 readiness、ALB / DNS / SSL / ICP / Redis / RDS / 对象存储闭环由 `T-935` 承接。
- Coverage review: 对照 `/Users/phoenix/Downloads/llm_runtime_routing_and_injection_design.md` 后，repo 侧已无未承接的高信号设计缺口；当前剩余的是外部验证与输入缺口：
  - `T-935` 仍需落位正式 deploy workspace；在此之前，staging 允许由 operator 本机完成 `bws` compile 并手工导入 ECS `.env`，但该路径不得升级为长期正式控制面。
  - `T-936` 的 kind-staging live closeout 已完成；若后续仍要求云 staging 再跑一轮同名 gate，应明确视为 `T-128/T-935` 的 promote/backout 证据补充，而不是 `T-936` repo/blocker。
  - `T-930` 的 auth delivery 真实联调已完成一轮收口：4 个非 secret env 值已落位，SMS 已不再阻塞；当前只剩 staging SMTP secret 漂移需要 operator 修正。
  - 需求文档中 “接入 visibleProviderPin” 已被当前方案替换为“移除 visible pins 主路径语义”，并已在现行任务合同中作为 superseded 决策保留。

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

## Temporary Freeze Override (2026-04-07)

- `staging` temporarily switches from `ECS web + ECI worker` to `single ECS host + Docker Compose web/worker` for fastest launch closure.
- This override is temporary and staging-only.
- `prod` does not inherit this topology automatically; the long-term worker topology remains a follow-up decision.
- Immutable image, build-once-promote-many, Redis-backed runtime contracts, and policy/registry routing authority remain unchanged.
- Release bookkeeping temporarily keeps the legacy target label `eci_worker` even though staging execution uses a same-host Compose worker.

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
- [x] `T-936` 的 staging closeout evidence 已回写到 `T-128`，包括 visible / hidden-worker / identity 三条 lane 的通过记录或阻塞项。
- [ ] 文档内不存在影响后续实施的高影响未决决策。
