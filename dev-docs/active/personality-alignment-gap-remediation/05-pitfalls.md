# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要在没有可见性审计的情况下把 signal 默认设为 `PUBLIC`。
- 不要在 request-time 做无界全量扫描（尤其是 chronicle metrics 汇总）。
- 不要只修“主路径帖子场景”，必须同步覆盖 COMMENT 等并行入口。

## Pitfall log (append-only)

### 2026-03-02 - 规划阶段初始化
- Symptom:
  - 审查报告问题分散在多个子系统，容易被拆散后遗漏验收。
- Context:
  - T-045~T-047 分别有独立目标，但报告问题跨任务边界。
- What we tried:
  - 评估继续沿用原任务增量补丁。
- Why it failed (or current hypothesis):
  - 缺少统一验收出口，风险项（flag/proactive/perf）容易无人兜底。
- Fix / workaround (if any):
  - 新建 T-048 作为总修复任务，统一 phase 与验收。
- Prevention (how to avoid repeating it):
  - 遇到跨任务高耦合整改，优先建立 umbrella task，再按 phase 落子任务。
- References (paths/commands/log keywords):
  - `dev-docs/active/personality-alignment-gap-remediation/*`
  - `node .ai/scripts/ctl-project-governance.mjs query --status in-progress`

### 2026-03-02 - Signal 隔离口径误伤 batch 成就
- Symptom:
  - `achievements-orchestrator` 用例失败：`chronicle_spotlight` 未授予。
- Context:
  - 在做 signal 去污染时，把 `public_entries/activity_days/chronicle_entries` 全部切成 narrative-only。
- What we tried:
  - 直接复用 narrative 计量覆盖所有字段。
- Why it failed (or current hypothesis):
  - 需求仅要求去除 `chronicle_entries` 的 signal 污染；`public_entries/activity_days` 全改会改变既有批处理成就语义。
- Fix / workaround (if any):
  - 保持 `public_entries/activity_days` 为全量口径；仅 `chronicle_entries` 使用 narrative-only。
  - 在 `ChronicleSignalMetrics` 中保留 narrative 扩展字段，避免再次混淆。
- Prevention (how to avoid repeating it):
  - 做计量口径改造时，先逐字段映射到业务定义，不要一次性“全字段同口径替换”。
- References (paths/commands/log keywords):
  - `src/backend/repos/{chronicle-repository.ts,pg/pg-chronicle-repository.ts}`
  - `src/backend/services/achievements-orchestrator.ts`
  - `pnpm -s vitest run src/backend/services/__tests__/achievements-orchestrator.test.ts`

### 2026-03-02 - PG fire-and-forget 写入导致 API 伪成功
- Symptom:
  - `POST /v1/agents` 返回 201，但随后 `POST /v1/agents/:id/chat/sessions` 可触发 `private_sessions_agent_id_fkey`。
  - `/v1/dev/seed` 可触发 `posts_community_id_fkey` / `posts_author_agent_id_fkey`。
- Context:
  - PG repository 的部分 create 路径采用“先写 cache，再异步落库并吞错日志”。
- What we tried:
  - 直接依赖 cache 对象继续下游写入（session/post/comment）。
- Why it failed (or current hypothesis):
  - 下游路径依赖 DB FK，cache 成功不代表 FK 依赖对象已持久化。
- Fix / workaround (if any):
  - 建立 Delta-2：关键入口增加持久化确认与错误语义收敛；seed 顺序化并以 DB 可见对象推进。
- Prevention (how to avoid repeating it):
  - 对存在 FK 依赖的链路，禁止“fire-and-forget 持久化 + 立即返回成功”语义。
- References (paths/commands/log keywords):
  - `/tmp/t048-staging-evidence-v2.json`
  - `private_sessions_agent_id_fkey`
  - `posts_community_id_fkey`
  - `posts_author_agent_id_fkey`

### 2026-03-02 - 修复闭环：create 路径必须有“可等待持久化”分支
- Symptom:
  - 需要在不破坏现有同步接口调用方前提下，修复关键链路的一致性。
- Context:
  - 直接把所有 repository `create` 改 async 会导致大面积接口破坏和测试重写。
- What we tried:
  - 为 repository 增加可选 `createPersisted`，仅在关键入口（control-plane create-agent、dev-seed）走可等待分支。
- Why it worked:
  - 保持历史同步路径兼容，同时让关键 FK 链路具备 request 内持久化确认。
- Fix / workaround (if any):
  - `AgentRepository` / `CommunityRepository` 增加 `createPersisted?`
  - PG repo 实现 `createPersisted`（await DB 后写 cache）
  - 关键入口切换为 persisted path
  - private-session on P2003 映射 `409 DEPENDENCY_NOT_READY`
- Prevention (how to avoid repeating it):
  - 遇到“全局接口改 async”成本过高时，优先引入兼容式 persisted 分支，并只在高风险入口强制使用。
- References (paths/commands/log keywords):
  - `src/backend/repos/agent-repository.ts`
  - `src/backend/repos/community-repository.ts`
  - `src/backend/routes/control-plane.ts`
  - `src/backend/routes/dev-seed.ts`
  - `src/backend/services/private-channel-service.ts`

### 2026-03-02 - 证据脚本的真实调用稳定性依赖 secret/model 对齐
- Symptom:
  - evidence 脚本初版出现：
    - `Invalid service token signature`（401）
    - private chat `model_not_found`（默认 `gpt-4o`）
- Context:
  - 本地 staging 使用 K8S secret 管理 `SERVICE_AUTH_SECRET`，且 runtime 模型为 `qwen-plus`。
- What we tried:
  - 直接在脚本中写默认 secret 与默认模型。
- Why it failed (or current hypothesis):
  - 集群实际 secret 与默认值不一致；新建 agent 未显式指定模型时会落到后端默认模型。
- Fix / workaround (if any):
  - 脚本增加 secret 自动解析：`secret/forum-app-secret` -> `SERVICE_AUTH_SECRET`。
  - 脚本增加 `--agent-model` 与 runtime 模型自动探测，创建测试 agent 时显式写入模型。
- Prevention (how to avoid repeating it):
  - 真实调用脚本必须避免硬编码 secret/model，优先读取当前运行环境有效值。
- References (paths/commands/log keywords):
  - `scripts/t048-staging-evidence.mjs`
  - `/tmp/t048-evidence-smoke.json`
  - `Invalid service token signature`
  - `model_not_found`

### 2026-03-03 - allocator pod benchmark 将 director 探索噪声混入“稳定性”门槛
- Symptom:
  - `t048-staging-evidence` 在 top-k 门槛出现显著负提升（treatment < baseline）。
- Context:
  - 脚本将 `casting director` 打开后的最终 `agents` 直接用于 Jaccard 稳定性，混入 contrast/wildcard 探索分配。
- What we tried:
  - 先尝试降低 benchmark 迭代数（避免 OOM），但 top-k 仍不稳定。
- Why it failed (or current hypothesis):
  - 指标目标是评估 allocator 主排序（PPR）稳定性，而 director 的探索位天然增加扰动，不应直接并入同一门槛。
- Fix / workaround (if any):
  - 将 allocator bench treatment 环境改为 `FF_CASTING_DIRECTOR_ENABLED=false`、`FF_CASTING_DIRECTOR_V2=false`，仅比较 PPR 稳定性。
  - 同时引入 `topk_gate_mode`（`relative_uplift` / `saturation_non_regression` / `absolute_floor_when_baseline_zero`）确保高基线场景可解释。
- Prevention (how to avoid repeating it):
  - 设计门槛时必须先隔离“稳定性指标”与“探索性策略”的评估面，避免一条指标同时承载相反优化目标。
- References (paths/commands/log keywords):
  - `scripts/t048-staging-evidence.mjs`
  - `/tmp/t048-evidence-fix-20260303.json`
  - `topk_gate_mode`
