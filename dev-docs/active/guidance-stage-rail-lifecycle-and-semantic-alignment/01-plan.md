# 01 Plan

## Execution objective
- 把规划包补成可以直接指导编码的执行 SoT。
- 每个 slice 都必须回答五个问题：
  - 改哪些文件
  - 依赖谁先落地
  - 完成后系统行为怎么变
  - 如何验证
  - 哪些兼容债会在后续 slice 中回收

## Slice map
1. S1: contract bridge and event scaffold
2. S2: backend summary-composition reset
3. S3: frontend rail takeover and snooze UX
4. S4: internal track de-dependency
5. S5: physical cleanup and schema/type removal
6. S6: verification and governance closure

## Executable implementation slices
| Slice | Goal | Primary files/modules | Depends on | Definition of done | Verification |
|---|---|---|---|---|---|
| S1 | 冻结 rail takeover 内部合同、local snooze 模型、client event 契约 | `src/backend/guidance/guidance-events.ts`, `src/backend/routes/guidance-api.ts`, `src/backend/routes/__tests__/guidance-api.test.ts`, `src/frontend/api/types.ts`, `src/frontend/api/hooks/guidance.ts`, extracted rail helpers if needed | none | `GUIDANCE_TAKEOVER_SNOOZED` 被后端接收；前端存在稳定的 `reason/scope_key/expires_at` 存储模型；不新增 `summary.modules[]` enum | route test, hook test or targeted unit test, typecheck |
| S2 | 去掉 `DUAL_ENTRY`，将 summary/checklist 改为 fact-driven | `src/backend/guidance/guidance-state-service.ts`, `src/backend/guidance/guidance-copy-service.ts`, `src/backend/guidance/guidance-types.ts`, `src/backend/guidance/reason-codes.ts`, backend guidance tests | S1 | summary 不再无条件产出 `DUAL_ENTRY`；checklist 不再按 `current_track` 分支；retained rail 不再由 generic checklist 驱动 | backend service tests, API summary test, `rg` for `HOME_DUAL_ENTRY` runtime usage shrinking |
| S3 | 切换首页右 rail 为“默认我的智能体 + Guidance takeover” | `src/frontend/widgets/shell/ShellRightRail.tsx`, `src/frontend/widgets/shell/__tests__/ShellRightRail.test.tsx`, extracted rail selector/snooze store | S2 | 默认界面仍是“查看我的智能体”；只在 whitelist reason 成立时 takeover；`稍后再看` 能 local snooze 并立即回退 | ShellRightRail tests, manual home-feed walkthrough |
| S4 | 让 runtime 不再依赖 `track` | `src/backend/guidance/guidance-orchestrator.ts`, `src/backend/guidance/guidance-state-service.ts`, `src/backend/guidance/__tests__/guidance-recall-scheduler.test.ts`, `src/backend/services/__tests__/guidance-orchestrator.test.ts` | S2, S3 | orchestrator/checklist/summary/recall 无运行时 `GuidanceTrack` 依赖；`current_track` 仅剩 dead compatibility data | backend unit/integration tests, targeted `rg` confirming no decision branch on `current_track` |
| S5 | 物理删除 dual-entry/track/schema/type/test 债务 | `src/backend/repos/types/guidance.ts`, `src/backend/repos/pg/pg-guidance-state-repository.ts`, `src/backend/guidance/guidance-types.ts`, `src/frontend/api/types.ts`, `prisma/schema.prisma`, `docs/context/db/schema.json`, migrations, fixtures, docs | S4 | `GuidanceTrack`, `current_track`, `explained_two_tracks`, `DUAL_ENTRY`, `HOME_DUAL_ENTRY` 从 schema/type/runtime/test/docs 全部退场 | migration + DB context sync, targeted test suites, `rg` no-match audit |
| S6 | 收口验证、治理与回滚说明 | `04-verification.md`, `.ai/project/main/*`, all changed test surfaces | S5 | verification matrix 完整；任务包可单独指导实施和回归；project hub 无漂移 | governance sync/lint, final verification checklist |

## Contract-bridge rules during execution
- S1-S4 期间：
  - `GuidanceActorView.current_track` 和 `explained.two_tracks` MAY 继续存在于 API 中作为兼容字段。
  - 新的 rail takeover 逻辑 MUST NOT 读取这两个字段。
  - backend runtime decision MUST 优先切到事实字段：
    - `followed_first_agent_at`
    - `following_feed_seen_at`
    - `agent_created_at`
    - `private_session_created_at`
    - `nurture_receipt_ready_at`
    - `watch_public_effect_at`
- S5 期间：
  - 兼容字段 MUST 被物理删除。
  - DB schema 变更 MUST 通过 repo Prisma SSOT 工作流完成。

## Coverage review
| Requirement / target | Covered by slices? | Notes |
|---|---|---|
| UI/UX 去教程化 | yes | S2 rewrite copy/composition + S3 rail takeover UX |
| 全生命周期流程重构 | yes | S2, S4 |
| 项目级语义退场 | yes | S2, S5, S6 |
| 默认 rail 保持“查看我的智能体” | yes | S3 |
| `稍后再看` 本地 authoritative | yes | S1, S3 |
| `track` 三阶段都在本任务内完成 | yes | S2, S4, S5 |
| 可执行验证与治理闭环 | yes | S6 |

## Execution blockers review
- Closed:
  - `Q4` retained-stage rail behavior is no longer open; retained takeover is whitelist-only, not checklist-driven.
  - rail-snooze authority and event contract are fixed.
  - `track` migration order is fixed.
- No remaining blocker prevents implementation slicing.
- Remaining implementation discretion is non-blocking:
  - rail selector helpers can stay in `ShellRightRail.tsx` or be extracted into `src/frontend/features/guidance/rail/*`
  - freshness helper implementation can live backend-side or shared utility-side as long as behavior matches roadmap

## Recommended execution order
1. Land S1 to freeze bridge contracts first.
2. Land S2 so the backend summary no longer emits `DUAL_ENTRY`.
3. Land S3 and switch the homepage rail behavior.
4. Land S4 and remove runtime `track` dependence.
5. Land S5 for schema/type/test/docs cleanup.
6. Finish with S6 verification and governance closure.

## Risks & mitigations
- Risk: 只删文案不删 contract，导致 dual entry 语义通过 API 或 telemetry 继续泄漏。
  - Mitigation: 在 roadmap 中单列“语义退场矩阵”，按 backend contract、frontend surface、docs、observability 四个维度逐项核销。
- Risk: 为了去教程化而让新用户失去最小引导。
  - Mitigation: 采用阶段化主卡 + 次级建议 + payoff 卡，不回到空白 rail。
- Risk: rail 与 inbox / bell / private receipt 重新分叉成不同生命周期。
  - Mitigation: 把“canonical item + surface variant”原则继续保留到新任务包中。
- Risk: `current_track` 以“兼容字段”名义长期残留，最后没有完成物理清理。
  - Mitigation: 在 roadmap Phase 4 设置显式 cleanup gate，要求类型、持久层、tests、seed 一并退场。
- Risk: 为了追求更强的 rail 表达而过早扩张 module taxonomy，导致 contract 震荡。
  - Mitigation: 先把创新限制在 stage-aware composition 和 presentation 层；只有现有 primitives 被证明不足时，才重新评估 metadata 扩展。
- Risk: guidance rail 在触发后长期滞留，变成新的默认界面。
  - Mitigation: 明确 trigger/exit 规则；触发理由消失后必须回到“我的智能体”。
- Risk: “我的智能体”和 guidance 被做成两套长期并行 rail。
  - Mitigation: 保持“我的智能体” UIUX 暂时不改，只定义 guidance takeover 的进入和退出。
- Risk: whitelist 范围过宽，导致 Guidance 频繁接管默认 rail。
  - Mitigation: V1 仅允许 4 个高价值 takeover reason；其余继续留在普通 surface 中。
- Risk: “稍后再看” 被实现成 completed/dismissed，破坏 canonical guidance 生命周期。
  - Mitigation: 明确其仅作用于 rail takeover 的短期 snooze，不改变 canonical item 完成态。
- Risk: `NO_AGENT_BOOTSTRAP` 或 `UNREAD_RECEIPT_READY` 触发条件过于宽松，导致不必要 takeover。
  - Mitigation: `NO_AGENT_BOOTSTRAP` 只看登录态与 agent 数量；`UNREAD_RECEIPT_READY` 必须同时满足 active、unread、freshness window。
- Risk: rail-level snooze 被错误落到 backend authoritative state，导致跨 surface 语义混乱。
  - Mitigation: V1 明确采用 localStorage authoritative + backend event-only 模式。
- Risk: S5 提前开始，导致 schema/type 删除早于 runtime 去依赖。
  - Mitigation: 以 S4 作为硬 gate；只有当 runtime 分支已与 `GuidanceTrack` 脱钩后，才能删除 Prisma/schema/repo 字段。
