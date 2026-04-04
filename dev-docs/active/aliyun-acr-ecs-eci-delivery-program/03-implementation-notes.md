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

## 2026-04-04

- `T-936` 已完成 repo 侧主实现，`T-128` 因此更新 parent narrative：
  - visible / hidden / identity / vision_summary 的 callsite cutover 已从“inventory 设计中”推进到“代码已切换，等待 live closeout”；
  - execution-plan observability 已扩展到 usage ledger、admin runtime features、rollout evidence collector；
  - staging live gate 已从单一 `verify:launch:staging` 拆分为“两层门”：
    - `verify:launch:staging` 负责 platform/readiness；
    - `verify:runtime:closeout:staging` 负责 visible / hidden-worker / identity lane-level closeout。
- `T-128` 对 `T-936` 的 handoff/acceptance 口径同步收紧：
  - hidden/worker 证据必须来自真实 `PrivateChannelScheduler -> checkTimeouts -> generateDigest` 路径；
  - identity gate 证据必须带 `identity_write-*` policy attribution，不能只看 typed write 成功；
  - deprecated `LLM_PROVIDER / LLM_MODEL / LLM_BASE_URL` env pin 现在被视为 closeout blocker，除非 operator 显式 emergency 放行。
- follow-on 范围明确化：
  - 图片生成治理继续遵循 provider/model/credential/prompt/trace 同一治理方向；
  - 但该项仍停留在 `T-128` follow-on，不进入本轮 `T-936` staging blocker。
- `T-936` audit/cleanup 之后，`T-128` 的 handoff 口径进一步收紧：
  - visible closeout 不再接受“只有 private-reply 能跑通”的半闭环状态，repo 现已补齐 `proactive-opening` fallback；
  - hidden/worker fixture 必须对 message density 安全，不能依赖人工记忆 message timeline；
  - 本轮暴露出来的 LLM test/type debt 已随 repo 侧 cleanup 一并消化，避免后续把“旧基线报错”误当成 `T-936` 未闭环；
  - 旧的 `.ai/.tmp/tests/environment/20260403-095855-87e8b7` 测试日志已删除，不再把过时临时产物计入 parent narrative evidence。
- 2026-04-04 再次收口后，`T-128` 对三条主线的 parent narrative 更新如下：
  - `T-901` 已把 remaining repo-side hard gap 从“candidate 覆盖存在隐式宽容”收口为“candidate 必有 explicit capability + pricing，且 `modalities / response_modes` 为强制字段”。
  - `T-936` 已把 debug/emergency override 从占位状态升级为 recent-ledger + process-env 真证据，并把 `verify:launch:staging` 扩展到 `api/worker` 双边 runtime cleanliness gate。
  - 因此 `T-128` 当前剩余 blocker 已只指向外部前提，不再包括 repo 内的 runtime contract 漏口。
- 当前真实部署链路已在 parent narrative 中改写为：
  - GitHub Actions 只负责 build/publish 到 ACR；
  - web ECS 通过同一专属网络拉取镜像；
  - `api` 仍以 env-file 注入为正式 contract，但执行面应从“人工上传文件”收口到 operator-owned deploy workspace 上的 `env-localctl compile + env-cloudctl apply`；
  - worker ECI 目前仍停留在 rendered/apply-ready，尚未形成正式上线证据。
- 同步冻结一个 staging-only bootstrap 例外：
  - 在 deploy workspace 尚未落位前，允许 operator 本机完成 `api` 的 Bitwarden compile，并手工把 `.env` 导入 ECS；
  - 该路径只用于先跑通 staging 发布链路，不改变正式 cloud contract，也不适用于 `prod` 或 `worker`。
- `T-128` 的 cross-package gate 因此新增两个外部前提：
  - compile/apply 需要 STS role chain + `bws` CLI + `BWS_ACCESS_TOKEN` 的 deploy workspace；
  - staging closeout 不仅要看注入成功，还要看 ECS/ECI 经 NAT 或等效出方向能否真实访问 admitted provider 并返回结果。
- 2026-04-04 同步清理了 repo 既有 auth/admin TypeScript 基线错误，避免把无关类型债继续作为 staging closeout 噪声项：
  - bootstrap admin tests 不再直接改写 readonly config；
  - auth verification challenge payload 明确对齐 `Record<string, unknown>` 合同；
  - 未使用的 invite-code helper 已移除。
