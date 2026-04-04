# 01 Plan

## Phases

1. Phase A: 保持 `T-129/T-130/T-131` 的历史交付基线，并补建 `T-935/T-936`。`[in-progress]`
2. Phase B: 冻结 `T-129` 的 GitHub Actions -> ACR 镜像发布实施方案。`[pending]`
3. Phase C: 冻结 `T-130` 的 ECS web Compose 交付与回滚方案。`[pending]`
4. Phase D: 由 `T-935` 承接云环境全链路、IaC skeleton 与 workload-aware env injection。`[in-progress]`
5. Phase E: 由 `T-901/T-936` 承接 runtime execution-plan 与 live staging close-out。`[in-progress]`
6. Phase F: 冻结 deploy workspace / STS / BWS 前提，并把 `api env-file` 与 `worker ECI` 的 operator handoff 写成可执行 runbook。`[in-progress]`
7. Phase G: 汇总全链路验收矩阵、配置来源、迁移时序、NAT/provider reachability 与最终 handoff 说明。`[pending]`

## Detailed Steps

- 保留 `T-129/T-130/T-131` 的历史语义，并新建 `T-935/T-936` bundle。
- 让 `T-128` 作为 parent narrative，承接全链路目标、固定决策、依赖顺序和最终验收。
- 在 `T-128` 固化需求文档覆盖矩阵：
  - `T-901` 覆盖核心抽象、runtime 接线、policy/adapter、fallback/pricing、deprecated env 清理
  - `T-935` 覆盖 cloud injection boundary、IaC skeleton、go-live chain、staging/prod secret authority
  - `T-936` 覆盖参数迁移、trace/ledger/observability、live gate、promote prerequisites
- 让 `T-129` 明确镜像产物契约、ACR 命名与 tag、build-once-promote-many、Runner 网络形态、CI push 凭据与 Variables / Secrets 清单。
- 让 `T-130` 明确 ECS 宿主机形态、目录布局、共享反向代理、loopback upstream、运行时配置来源、ACR pull 认证、数据库迁移时序与发布/回滚步骤。
- 保留 `T-131` 作为 ECI worker repo 侧基线，不再把云环境、ALB、DNS、SSL、ICP 等新工作塞回其中。
- 让 `T-935` 明确 ALB / RDS / Redis / object storage / DNS / SSL / ICP readiness、ECS/ECI secret injection 边界、以及 Terraform skeleton。
- 让 `T-936` 明确 runtime cutover sequencing、staging live gate 与 observability handoff。
- 在 `T-128` 明确跨包 review gate：
  - `T-901` 完成后必须复核 execution-plan contract、pin strategy、provider.auth 定位、policy merge precedence
  - `T-935` 完成后必须复核 admitted providers secret coverage、api/worker target route、IaC ownership boundary、policy-only cloud routing freeze
  - `T-936` 完成后必须复核 callsite parameter inventory、trace persistence、staging live evidence、prod promote gate
- 在 `T-128` 与 `T-130/T-131` 同步冻结第一阶段部署触发模型：
  - GitHub Actions 只负责构建和推送镜像
  - `staging` / `prod` 发布由运维或发布人手动执行
  - 自动化部署控制面不在本轮范围
- 在 `T-128` 固化跨任务编排顺序：
  - 镜像发布
  - 在 operator-owned deploy workspace 上 compile env / inject api envfile
  - `pnpm db:migrate:deploy`
  - ECS web
  - health/smoke
  - ECI worker
  - runtime/queue 验证
  - NAT egress / model provider connectivity 验证
  - 人工晋升到下一环境
- 在 `T-128` 冻结 staging/prod 的 secret compile/apply ownership：
  - GitHub Actions 负责 build/publish 到 ACR，不承担运行时 secret 解密或落盘。
  - `api -> envfile` 的 compile/apply 必须在具备 STS role chain 与 `bws` 能力的 deploy workspace 执行。
  - `worker -> aliyun-eci-container-group` 的 apply 必须由同一 operator boundary 或等效 release workspace 执行。
- 在 `T-128` 明确 staging-only bootstrap 例外：
  - 若正式 deploy workspace 尚未落位，`staging` 允许 operator 在本机完成 `env-localctl compile`，再手工导入 ECS `.env`。
  - 该例外只允许用于 `api`，不改变 `worker -> aliyun-eci-container-group` 的正常路径。
  - `prod` 不得沿用该 bootstrap 例外，仍必须回到正式 deploy workspace / `env-cloudctl apply`。
- 在 `T-128` 明确 `T-935 -> T-936` 的额外 gate：
  - staging API env-file 必须真实生成到 `ops/deploy/env-files/staging.env` 或等效 operator-owned target。
  - ECS web 出方向必须经 NAT 或等效 egress 验证至少一个 admitted provider 可真实返回结果。
  - `verify:launch:staging` 与 `verify:runtime:closeout:staging` 的输入 (`web/worker/admin`) 必须在 handoff 中显式提供。
- 在 `T-128` 把 repo 既有 auth/admin 基线错误视为 staging 放行前的噪声项：
  - 先清掉 TypeScript 基线错误，再进入 live staging gate，避免把无关 repo debt 混入 runtime/cloud closeout。
- 在 `T-128` 与 `T-130` 冻结 prod 多 ECS 的额外前提：
  - `SSE_BROADCAST_BACKEND=redis`
  - `SSE_REDIS_URL` 可用
  - ALB/Caddy 支持长连接与 SSE 流式转发
- 在 `T-128` 与 `T-130/T-131` 冻结数据库回滚前提：
  - 应用镜像回滚默认不回退 schema
  - migration 必须满足至少一个版本窗口的向后兼容，或显式准备 DB 回退方案
- 运行 governance `sync`、`lint` 与任务查询，把执行结果记录到 `04-verification.md`。
