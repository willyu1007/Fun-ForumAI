# 03 Implementation Notes

## Current status
- 状态：phase-a-to-d-implemented
- 说明：T-047 已完成 Phase A-D 的代码落地与验证，待最终评审与灰度执行。

## Execution log
- 2026-03-01 Phase 0 完成：更新 `00/01/02/04/05`，写入锁定决策（双开关、30 成就池、public highlights 新路径、owner+admin 权限与审计、Growth 页重做策略）。
- 2026-03-01 Phase A 完成：
  - Prisma 新增 `AchievementVisibility`、`ChronicleType`、`agent_achievements`、`chronicle_entries`。
  - 新增迁移 `20260301103000_achievement_chronicle_v1`。
  - 新增仓储：
    - `src/backend/repos/achievement-repository.ts`
    - `src/backend/repos/chronicle-repository.ts`
    - `src/backend/repos/pg/pg-achievement-repository.ts`
    - `src/backend/repos/pg/pg-chronicle-repository.ts`
  - `container.ts` 注入 achievement/chronicle repo，支持 Prisma 与 in-memory 双模式。
- 2026-03-01 Phase B 完成：
  - 新增 30 条成就字典：
    - `src/backend/services/achievements/definitions.ts`
  - 新增评分器：
    - `src/backend/services/achievements/importance-scorer-v1.ts`
  - 新增编排与读写服务：
    - `src/backend/services/achievements-orchestrator.ts`
    - `src/backend/services/achievement-chronicle-service.ts`
  - 事件接入：
    - forum 事件：`forumWriteService` hook
    - private digest：`MemoryService.setDigestHook`
    - relation 状态变化：`RelationService.setStateChangeHook`
    - governance 结果：`GovernanceAdapter.setExecutedHook`
  - 新增 `AchievementsScheduler`（daily/weekly batch）：
    - `src/backend/runtime/achievements-scheduler.ts`
- 2026-03-01 Phase C 完成：
  - Control Plane:
    - `GET /v1/agents/:agentId/achievements` 从 501 改为可用（owner/admin）。
    - 新增 `GET /v1/agents/:agentId/chronicle`（owner/admin，支持 `include_folded`）。
    - admin 访问写 `AchievementAccessAudit` 结构化日志。
  - Read API:
    - 新增 `GET /v1/agents/:agentId/highlights`（public）。
    - 保持旧 `GET /v1/highlights` 兼容。
  - Feed/Profile:
    - `AuthorSummary` 扩展可选 `badges/tagline`。
    - `PostCard` 渲染作者 badge/tagline（缺省不渲染）。
    - Growth 页替换为新主视图组件 `AchievementChroniclePanel`。
    - 前端 hooks/types 新增 achievements/chronicle/highlights。
- 2026-03-01 Phase D 完成：
  - 新增 flags：
    - `FF_ACHIEVEMENT_CHRONICLE_V1`
    - `FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS`
  - 更新 `env/contract.yaml` 与 `src/backend/lib/config.ts`。
  - `app.ts` 启动 `AchievementsScheduler`（存在时自动启动）。

## Planned decision log
- Decision-001: 成就授予以 code+tier 做唯一键，禁止 title 作为幂等依据。
- Decision-002: 编年史条目必须绑定 evidence，避免不可回放叙事。
- Decision-003: public API 只返回 visibility=PUBLIC 条目，owner-only 在 read 侧不可见。
- Decision-004: 事件驱动指标统一通过 chronicle tags 汇总，避免跨仓储临时计数字段。
- Decision-005: 密度治理采用 read-time 折叠，不在写入链路做硬截断。

## Open follow-ups
- 生产环境灰度阶段需观测 `AchievementAccessAudit` 与 `PromptAudit` 总日志量。
- 若 public highlights 噪音偏高，后续在 T-047.x 增加 importance 最低阈值开关。
