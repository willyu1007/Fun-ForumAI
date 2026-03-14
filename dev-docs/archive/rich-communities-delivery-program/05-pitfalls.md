# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要把“舞台规则”只写在提示词里，必须有系统硬闸执行路径。
- 不要在 T4 长文链路中绕过授权/脱敏门禁。
- 不要让 audience 原文直接进入 agent prompt。

## Pitfall log (append-only)

### 2026-03-04 - 初始规划阶段
- Symptom:
  - 方案跨度大，容易把“规划”和“实现”混在一次变更里导致失控。
- Context:
  - Rich Communities 涉及 runtime、allocator、moderation、私聊、治理与前端。
- What we tried:
  - 先以 roadmap 明确阶段边界，再建立完整任务包。
- Why it failed (or current hypothesis):
  - N/A（当前未失败）。
- Fix / workaround (if any):
  - 采用 PKG-1..PKG-6 顺序推进，每包单独 gate。
- Prevention (how to avoid repeating it):
  - 每包开始前冻结输入输出；每包结束后记录可验收证据。
- References (paths/commands/log keywords):
  - `dev-docs/active/rich-communities-delivery-program/*`
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`

### 2026-03-04 - migration 误连本机 PostgreSQL（非 db-local 容器）
- Symptom:
  - `prisma migrate` 反复出现 advisory lock timeout，且“重建 db-local 容器后”数据仍旧存在。
- Context:
  - 本机已有另一个 PostgreSQL 占用 `localhost:5432`，`db-local` 容器虽启动但验证命令实际命中了宿主库。
- What we tried:
  - 直接 `db:local:down/up + db:migrate:deploy`，结果仍显示历史数据与旧 migration 记录。
- Why it failed (or current hypothesis):
  - 默认端口 `5432` 存在冲突/混淆，迁移并未在预期隔离环境执行。
- Fix / workaround (if any):
  - 使用隔离端口容器（`LOCAL_DB_PORT=55432`）+ 显式 `DATABASE_URL=postgresql://...:55432/...` 执行回放验证。
- Prevention (how to avoid repeating it):
  - 所有“空库回放验证”必须固定使用独立端口并在命令中显式传入 `DATABASE_URL`，不要依赖默认 `localhost:5432`。
- References (paths/commands/log keywords):
  - `LOCAL_DB_CONTAINER=funforum-local-pg-55432 LOCAL_DB_PORT=55432 pnpm -s db:local:up`
  - `DATABASE_URL=postgresql://yurui@localhost:55432/llm_forum_dev pnpm -s db:migrate:deploy`

### 2026-03-04 - Season Rotation 直接执行带来误操作风险
- Symptom:
  - 轮换动作会直接改写 legacy source manifest 与 `dist/*.json`，若参数错误会造成不必要换绑。
- Context:
  - 首发已同时提供脚本和 Admin 按钮，两种入口都可触发真实写入。
- What we tried:
  - 先在接口层提供 `dry_run`，再在手册中强制“先 dry-run，再执行正式轮换”。
- Why it failed (or current hypothesis):
  - 过去仅有脚本说明，缺少统一的“预演 -> 执行 -> 复核”顺序提示。
- Fix / workaround (if any):
  - 新增操作标准：`dry_run=true` 预演、核对 `activated/replaced`、再执行正式轮换。
- Prevention (how to avoid repeating it):
  - 每次轮换都要走同一流程：`validate -> dry-run -> rotate -> export/verify -> commit`。
- References (paths/commands/log keywords):
  - `POST /v1/admin/stage/season-rotate`
  - scene-pool season rotation manual（legacy source tree；removed in T-099）

### 2026-03-04 - K8s smoke 在 rollout 窗口误选旧 Pod
- Symptom:
  - T-023~T-025 套件偶发失败，报错 `kubectl port-forward exited before ready ... pod is not running (Succeeded)`。
- Context:
  - `k8s:staging:local:smoke` 会先 rollout backend，再立即进入多 Pod 冒烟。
  - 原始 Pod 发现逻辑仅筛 `status.phase=Running`，未排除“终止中/未就绪”实例。
- What we tried:
  - 复跑单项 smoke 发现可通过，但整套流程在重启窗口仍会偶发误选。
- Why it failed (or current hypothesis):
  - Pod 列表在 rollout 切换期存在短暂竞态；仅按 phase 过滤不足以保证可 port-forward。
- Fix / workaround (if any):
  - Pod 过滤改为 `Running + Ready + metadata.deletionTimestamp 为空`；
  - Pod 选择顺序改为优先最新创建实例（creationTimestamp desc）。
- Prevention (how to avoid repeating it):
  - 所有 K8s smoke 的 Pod 发现统一复用同一过滤标准，禁止只按 `phase=Running` 选 Pod。
  - rollout 后的第一轮 smoke 必须在日志中保留 `podsBefore/podsAfter` 证据。
- References (paths/commands/log keywords):
  - `scripts/runtime-staging-smoke.mjs`
  - `scripts/k8s-smoke-utils.mjs`
  - `pnpm -s k8s:staging:local:smoke -- --k8s-context kind-funforum --k8s-namespace funforum`
