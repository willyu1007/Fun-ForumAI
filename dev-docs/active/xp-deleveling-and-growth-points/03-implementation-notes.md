# 03 Implementation Notes — xp-deleveling-and-growth-points

## Frozen decisions
- XP 无上限累计
- `50 XP = 1 growth point`
- growth points merge into Stats wallet
- relation capacity fixed to `180`
- historical XP total preserved
- legacy level/milestone events archived out of main XP ledger

## Migration assumptions
- `T-059` / `R-023` 为新增独立任务，不复用 T-048。
- schema/API/UI 会在 Phase 1 内同步去 level 化。
- achievements / chronicle / stage tier 继续独立运行。
- 第一阶段不做 XP earning 调参，只做语义收敛。

## Phase log template
### Phase <N> — <name>
- What changed:
  - <change>
- Why:
  - <reason>
- Deviations from frozen decisions:
  - none / <deviation>
- Remaining TODOs for next phase:
  - <todo>

## Phase 0 — Governance bootstrap
- What changed:
  - 新建 `dev-docs/active/xp-deleveling-and-growth-points/` 完整任务包。
  - 在 `.ai/project/main/registry.yaml` 新增 `R-023` 与 `T-059`。
  - 运行 project governance `sync --apply`，刷新 derived views。
- Why:
  - 在进入 schema / API / UI 去 level 化实现前，先建立稳定的任务上下文与治理映射。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - 设计并实现 XP / archive / stats sync 的 schema 迁移。
  - 清点 `/growth` 路径、`level` 字段与 UI 残留引用。

## Phase 1 — XP deleveling cutover
- What changed:
  - Prisma schema 改为 `AgentXp` / `XpEvent` / `LegacyGrowthEventArchive`，`AgentStats` 新增 `granted_points_total`。
  - 新增 `prisma/migrations/20260306153000_t059_xp_deleveling_phase1/migration.sql`，覆盖 `agent_growth -> agent_xp`、`growth_events -> legacy archive + xp_events`、stats 回填。
  - 新建 `src/backend/services/xp-service.ts`，移除旧 level/milestone 逻辑，XP 发放和 dedup 改查 `xp_events.dedup_key`。
  - `StatsService` 改为按 `floor(xp / 50)` 持续同步点数，写入 `xp_formula_sync` 审计事件。
  - trait / instruction / prompt override / relation cap 全部去 level 化；`vote_received` 正式接入 XP 发放。
  - API 切到 `/xp`、`/xp-events` 和 `dashboard.xp`；Web / Mobile 改为 XP + growth points 展示。
  - runtime/prompt 层完成 `layer1_growth -> layer1_traits` 与 `layer_growth -> layer_traits` 改名；prompt templates 同步替换占位符。
- Why:
  - 一次性收束 XP 的职责，移除旧 `level/slot/milestone` 语义，避免多套成长系统继续并存。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - 评估是否需要补充 achievements / stage tier 的更强回归验证。
  - 评估是否要把历史 migration 的幂等修补单独沉淀为治理规范。

## Phase 1.1 — Local DB apply and authenticated smoke
- What changed:
  - 在本地 `llm_forum_dev` 上实际执行了 `prisma migrate deploy`，使 `20260306153000_t059_xp_deleveling_phase1` 真正落库。
  - 为了让本地历史库可重放，修补了 `20260305045650_t052_t057_events_governance` 中的非幂等 `CREATE TYPE` / `ALTER TYPE` / `DROP INDEX` 语句。
  - 发现本地 `@prisma/client` 生成物仍停留在旧 `agentGrowth/growthEvent` 委托名，补跑 `pnpm exec prisma generate` 后重启 backend。
  - 使用 `DB_PERSISTENCE=true FF_AGENT_STATS_V1=true FF_AGENT_STATS_UI=true FF_NURTURE_PIPELINE_V2=true` 启动 backend，并完成 authenticated HTTP smoke。
  - 使用浏览器实际打开 Web Profile / Dashboard，确认已切换到 XP 语义且不再展示 `Lv.` / slot。
- Why:
  - 仅有 migration 文件与编译通过还不够；必须在真实 dev DB 和真实 HTTP/UI 会话里证明 Phase 1 行为闭环。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - 如需把 mobile 也纳入运行态 smoke，需要准备可启动的 RN/Expo 目标环境。

## Phase 1.2 — Cleanup and regression hardening
- What changed:
  - 清理了本地 DB 中由 smoke 产生的两只临时 agent、其房间/消息/XP/stats/traits 记录，以及 UI smoke 注册用户。
  - 运行 achievements / chronicle / stage tier 相关回归套件，确认 XP 去等级化未影响新身份线。
  - 检查 mobile 运行态环境：Expo Metro 可启动，但本机 `simctl` 没有可用 iOS 设备，因此未完成原生运行态 smoke。
- Why:
  - 清理验证残留，保持本地 dev DB 可继续使用；同时补强“XP 去语义化后，新身份线仍稳定”的证据。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - 如需完成 mobile 运行态 smoke，需要先准备 iOS Simulator 或 Android Emulator。

## Phase 1.3 — Product copy tightening
- What changed:
  - Web Profile 将原 `成长` 标签改为 `成就线`，把成就墙、编年史与关系节点明确收敛为独立身份线。
  - Dashboard 将 XP 卡片、XP 记录、Stats 点数摘要统一改成 `XP 与成长点 / 累计成长点 / 已分配成长点 / 待分配成长点` 语义。
  - 成就面板新增说明文案，明确“成就线独立于 XP，不消耗成长点，也不决定加点额度”。
  - Mobile 将 `成长` 页签改为 `XP`，将 `养成` 入口改为 `智能体`，登录提示同步改成 `智能体 / XP / 私聊`。
  - `StatsPanel` 补充对旧 fixture / 旧响应缺少 `granted_points_total` 时的兼容兜底，避免文案改造顺带暴露 `NaN`。
- Why:
  - Phase 1 已完成技术去 level 化，但产品入口仍残留“成长”混称。需要把 XP 资源线和成就身份线彻底拆成单义表达，避免用户继续把 XP 理解为身份/门槛系统。
- Deviations from frozen decisions:
  - none
- Remaining TODOs for next phase:
  - 如需完成 mobile 运行态 smoke，需要先准备 iOS Simulator 或 Android Emulator。
