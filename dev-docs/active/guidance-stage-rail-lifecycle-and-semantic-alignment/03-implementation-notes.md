# 03 Implementation Notes

## Status
- Current status: `planned`
- Last updated: 2026-04-16

## What changed
- 创建了新的 Guidance follow-up 任务包，用于承接旧 `Guidance & Onboarding V1` 语义之后的重定义工作。
- 本包已从“产品讨论包”补成“可执行实施包”：implementation slices、合同桥接、覆盖性检查与验证矩阵已经落地，尚未进入产品代码修改。

## Files/modules expected to change (high level)
- `src/backend/guidance/*`
- `src/frontend/widgets/shell/ShellRightRail.tsx`
- `src/frontend/api/types.ts`
- `src/frontend/api/hooks/guidance.ts`
- `src/frontend/features/guidance/*`
- `src/frontend/features/agents/components/*` 中依赖 guidance summary 的 surface
- `dev-docs/archive/guidance-*` 的后继治理文档引用
- `.ai/project/main/*` 派生视图

## Bundle completeness review
- Coverage status: complete for confirmed product goals.
- Blocking gaps: none.
- Closed during this review:
  - `RETAINED` rail behavior no longer blocks implementation; it is whitelist-only, not checklist-driven.
  - `稍后再看` state placement and event contract are frozen.
  - `track` cleanup order is frozen and now mapped to concrete slices.
- Remaining flexibility is implementation-local only:
  - helper extraction vs local colocation
  - exact unit-test file distribution

## Decisions & tradeoffs
- Decision: 新任务包按 `NEW_TASK` 处理，而不是恢复 `T-077/T-079` 旧包。
  - Rationale: 本轮不只是补充实现，而是重定义 Guidance 的产品语义和长期 contract；旧包是 V1 历史基线，不适合作为继续执行 SoT。
- Decision: 当前项目治理映射先沿用 `M-000 > F-000 > T-974`，并在 roadmap 中保留旧 `F-040 Guidance & Onboarding V1` 作为 lineage 参考。
  - Rationale: 现有 project hub 大量任务仍在 `F-000` 下运行，当前先保证新包可注册、可对齐，feature remap 作为本包的一项治理议题处理。
- Decision: `track` 不做 immediate hard delete，而是在本任务内完成三阶段退场。
  - Rationale: 语义重构要先于机械清理，但机械清理不能无限延期；因此三阶段都纳入 `T-974`。
- Decision: `summary.modules[]` 不在本轮引入新的 top-level taxonomy。
  - Rationale: 当前问题在于 dual-entry 的常驻与组装方式，而不是 primitive 不足；因此保留 `CHECKLIST / CARD / RECEIPT`，把创新放到 composition/presentation 层。
- Decision: “查看我的智能体”保持为右 rail 的长期默认界面，当前不改其 UIUX。
  - Rationale: 用户明确要求其作为长期优先展示界面。
- Decision: Guidance rail 改为条件触发的 takeover surface，并将讨论重点转向退出机制。
  - Rationale: 这比持续维护 quiet/active guidance taxonomy 更符合新的产品方向。
- Decision: Guidance takeover V1 只允许 4 个高价值白名单原因，并同时支持自动退出与显式返回。
  - Rationale: 第一版必须先控制噪音和打断频率，避免 rail takeover 泛化。
- Decision: `稍后再看` 只表示 rail-level snooze，不表示完成或永久 dismiss。
  - Rationale: rail takeover lifecycle 不能破坏 canonical guidance item lifecycle。
- Decision: `NO_AGENT_BOOTSTRAP` 与 `UNREAD_RECEIPT_READY` 采用显式结构/新鲜度条件，不走模糊 heuristics；V1 snooze 时长按 reason 分层配置。
  - Rationale: 触发与退出需要尽可能可预测，便于后续验证和调优。
- Decision: V1 rail-snooze 状态由前端本地持久化负责，后端只记录 `GUIDANCE_TAKEOVER_SNOOZED` 事件用于观测。
  - Rationale: 这是 surface-level display suppression，不应污染 canonical guidance lifecycle。
- Decision: 采用“canonical API contract + frontend internal selector contract”的桥接方式，而不是扩张 `summary.modules[]`。
  - Rationale: 既能串起 right rail takeover 的执行流，又不需要在本轮引入新的顶层 API taxonomy。
- Decision: `RETAINED` stage 的 right rail takeover 不再由 generic checklist 驱动。
  - Rationale: 这是让 implementation slices 可执行的必要闭环，否则 retained 行为会在 S2/S3 之间持续摇摆。

## Deviations from plan
- 暂无；当前 bundle 已进入 execution-ready planning 状态。

## Known issues / follow-ups
- 后续实现时需要重点核对：
  - `GuidanceSummaryView` 在 bridge 期的 deprecated 字段是否只保留不使用；
  - `GUIDANCE_TAKEOVER_SNOOZED` 是否只做 observability，不被误接成 lifecycle action；
  - S5 的 Prisma/schema cleanup 是否按 repo DB SSOT 工作流执行。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
