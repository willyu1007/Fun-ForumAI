# 03 Implementation Notes

## Status

- Current status: `bundle-created`
- Last updated: 2026-03-28

## What changed

- 建立 `T-128` 总任务 bundle，作为阿里云 ACR -> ECS/ECI 全链路交付的父叙事。
- 固定本轮只做文档与治理，不执行代码、CI、ECS 或 ECI 实施。
- 冻结核心决策：`cn-hangzhou`、`staging + prod`、`ACR Enterprise Edition`、`Docker Compose on ECS`、单镜像多角色。
- 将实施工作拆分为 `T-129`、`T-130`、`T-131` 三条可独立推进的执行线。
- 对照需求复检后，补入了七类高影响决策：build-once-promote-many、数据库迁移时序、运行时配置来源、运行时 ACR pull 认证、第一阶段人工部署控制面、prod 多 ECS 下的 SSE Redis 广播/长连接前提、数据库回滚兼容性前提。
- `T-129` 已开始进入实际 workflow 实施：仓库内已新增 ACR publish workflow、publish preflight 脚本与 CI handbook，GitHub 远端已创建 `staging` / `prod` environments，并完成 GitHub OIDC / RAM Role / self-hosted publish runner 的接通。
- `T-130` 已完成 repo 侧落地：`ops/deploy` 的 cloud 主线改为 `vm + Docker Compose`，canonical ECS host files 已加入 `ops/deploy/vm-compose/fun-forum/`，并明确了 immutable image、release state 与 rollback guard。

## Known follow-ups

- 需要通过 governance `sync` 把新任务收录进 project hub。
- 后续如需把本组任务从 `F-000` 提升到正式 Feature/Requirement，再单独做语义映射。

## 2026-04-03

- 按新的 Runtime Routing 与云上线全链路方案重排任务结构：
  - `T-131` 保持归档语义，不 re-open。
  - 新增 `T-935 cloud-environment-go-live-chain-v1` 承接云环境、ALB/DNS/SSL/ICP、IaC skeleton 与 env injection contract。
  - 新增 `T-936 runtime-cutover-observability-and-live-staging-closeout-v1` 承接 runtime cutover / observability / staging live close-out。
- `T-128` 的角色被收口为总编排入口，不再自行承载云环境细节或 runtime cutover 细节。
- `T-901` 当前已完成一轮 contract closeout，可作为 `T-128` review gate 的阶段性输入：
  - runtime 已冻结到 `InferenceExecutionPlan + ExecutionPolicy + AdapterBinding + CredentialBinding + merge trace` 的目标合同。
  - `routing_policies.yaml` 已退回 ordering-only；fallback allowlist 与 merge allowlist 均收口到 execution policy。
  - callsite dual-track inventory 已扩展到 `target_policy_id / migration_status / local_override_fields`，可以直接 hand off 给 `T-936` 做后续 cutover。
  - 2026-04-03 代码复核已补齐 runtime credential-ranking drift 与 inventory policy drift；`T-901` 代码层 review gate 现可视为关闭，只剩 live provider connectivity 作为非代码验收项继续保留。
- 根据 `T-935` closeout 方案，`LLM_PROVIDER / LLM_MODEL / LLM_BASE_URL` 已被确定为 superseded cloud contract，不再保留为 staging/prod 的环境级紧急开关。
- `T-128` 的父叙事同步冻结新的主线顺序：
  - `T-901` 稳定 runtime contract
  - `T-935` 稳定 cloud injection / go-live contract
  - `T-936` 完成 callsite cutover、observability 收口与 staging live 放行
- `T-935` 深度 cleanup 后又补齐了三个原本会影响 handoff 的 drift：
  - cloud/local context artifact 改为 workload-aware 命名，旧的 env-only cloud context 已删除；
  - `RUNTIME_ENABLED` 不再出现在 shared staging values 中，重新回到 `api compose=false / worker role=true` 的单一 authority split；
  - `prod` cloud baseline 已被正式写回 contract + values，不再依赖 dev-like defaults 或 staging-only scope 假设。
