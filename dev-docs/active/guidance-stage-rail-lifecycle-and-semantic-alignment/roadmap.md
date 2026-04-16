# T-974 Guidance Stage Rail Lifecycle And Semantic Alignment — Roadmap

## Goal
- 将 Guidance 从 `Guidance & Onboarding V1` 的双入口教学语义，迁移为 `stage-driven continuation system`。
- 在不占用首页主视觉的前提下，重定义首页右 rail 的 IA、文案语气、收起/展开交互和 lifecycle 作用。
- 建立一份可执行的迁移方案，覆盖 UI/UX、全生命周期流程、contract、telemetry 与项目治理语义。

## Planning-mode context and merge policy
- Runtime mode signal: User explicitly requested a full task bundle and roadmap before coding
- User confirmation when signal is unknown: not needed
- Host plan artifact path(s): (none)
- Requirements baseline:
  - Archived guidance lineage:
    - `dev-docs/archive/guidance-onboarding-v1-master/`
    - `dev-docs/archive/guidance-platform-foundation/`
    - `dev-docs/archive/guidance-web-core-experience/`
    - `dev-docs/archive/guidance-recall-and-observability/`
- Merge method: latest confirmed user decisions override archived V1 semantics
- Conflict precedence: latest user-confirmed > current implementation evidence > archived task semantics > model inference
- Repository SSOT output: `dev-docs/active/guidance-stage-rail-lifecycle-and-semantic-alignment/roadmap.md`
- Mode fallback used: yes (manual roadmap authoring; no dedicated `plan-maker` artifact generator available in-session)

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | chat (2026-04-16) | 新语义边界、右 rail 约束、mobile out-of-scope | highest | 明确要求去 dual entry、保留右 rail、默认多线并行 |
| Current implementation evidence | `src/frontend/widgets/shell/ShellRightRail.tsx`, `src/backend/guidance/*` | 判断现状与迁移范围 | high | 当前 dual entry 常驻且教程感偏强 |
| Archived guidance task lineage | `dev-docs/archive/guidance-*` | 历史目标、冻结 contract、不可重复问题 | high | 作为 lineage，不作为现行产品定义 |
| Project governance state | `.ai/project/main/registry.yaml` | Task registration baseline | medium | 当前大量任务仍映射 `F-000` |
| Model inference | N/A | 迁移排序、风险整理 | lowest | 仅用于补齐执行结构 |

## Triage decision
- Decision: `NEW_TASK`
- Rationale: 这不是旧 Guidance V1 包的简单续做，而是对产品语义、生命周期和右 rail surface 的 follow-up reset。
- Task ID: `T-974`
- Slug: `guidance-stage-rail-lifecycle-and-semantic-alignment`
- Current governance mapping: `M-000 > F-000 > T-974`
- Semantic lineage reference: legacy `F-040 Guidance & Onboarding V1` -> `T-077/T-078/T-079/T-080`

## Non-goals
- 不把 Guidance 迁移成首页中央主视觉。
- 不在本轮做移动端设计或适配决策。
- 不把 dual entry 退场误做成“空 rail”。
- 不在没有 roadmap 对齐前直接承诺删除所有底层 `track` 实现。
- 不单独为 rail 新增一条脱离 inbox / bell / receipt 的平行生命周期。

## Open questions and assumptions
### Blocking open questions
- None.
- Q4 has been closed:
  - `RETAINED` 阶段的首页右 rail takeover 不再由 generic checklist 驱动。
  - `RETAINED` rail 只允许由 whitelist 中的高价值 continuation/payoff reason 接管。
  - checklist 可以在 canonical summary 内短期存在于兼容期，但不得继续作为 retained rail takeover 的默认来源。

### Assumptions (if unanswered)
- A1: 旧 dual entry 的所有用户可见语义都应退场，包括标题、文案、badge、event naming 和文档叙事。(risk: low)
- A2: Guidance 总开关继续保留为一个 feature flag，不新增长期存在的 rail-specific feature flags。(risk: low)
- A3: 右 rail 会继续是桌面 feed surface 的主要承接位，短期不迁移到主 feed 或 programming shelves。(risk: low)

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | Product framing | Archived V1 dual-track onboarding vs current user request | Remove dual entry semantics completely | Latest user-confirmed | Audit all dual-entry contract leakage |
| C2 | Surface ownership | “Should guidance move into homepage main visual?” vs current user request | Keep guidance in right rail | Latest user-confirmed | Define rail IA instead of shelf takeover |
| C3 | User segmentation | Spectator/owner split vs “default user plays both lines” | Stop using split as primary UX framing | Latest user-confirmed | Rework copy, stage logic, and receipts framing |
| C4 | Mobile scope | Full lifecycle redesign could imply mobile | Defer mobile | Latest user-confirmed | Keep desktop-only in this task bundle |
| C5 | `track` migration policy | Immediate hard-delete vs compatibility-first removal | Complete all three phases inside `T-974`: semantic retirement -> internal de-dependency -> physical cleanup | User confirmed phased completion inside one task | Freeze as execution baseline before discussing Q2 |
| C6 | `summary.modules[]` taxonomy | New module taxonomy vs reuse existing primitives | Remove `DUAL_ENTRY`, keep `CHECKLIST / CARD / RECEIPT`, and move structural change to composition/presentation logic | User confirmed | Discuss stage-by-stage assembly instead of API enum expansion |
| C7 | Rail responsibility | Guidance-only rail vs split rail with agent view | Keep “my agents” as the default right rail; Guidance becomes a conditional takeover surface with explicit return | Latest user-confirmed | Define trigger conditions and exit behavior instead of maintaining long-lived quiet/active guidance modes |
| C8 | Retained-stage behavior | Retained rail still using checklist vs continuation-only takeover | Retained right rail takeover must not be driven by generic checklist items; only whitelist continuation/payoff reasons may take over | Needed to unblock implementation slicing | Close Q4 and freeze rail behavior |

## Scope and impact
- Affected areas/modules:
  - Backend guidance semantics: `src/backend/guidance/*`
  - Guidance runtime consumers: `src/frontend/widgets/shell/ShellRightRail.tsx`, inbox, bell-adjacent surfaces, agent modal guidance consumers
  - Frontend type contracts: `src/frontend/api/types.ts`, hooks, telemetry callers
  - Archived/new governance docs and project-hub references
- External interfaces/APIs:
  - `GET /v1/guidance/summary`
  - `POST /v1/guidance/client-events`
  - `POST /v1/guidance/items/:id/action`
- Data/storage impact:
  - Initial expectation: no schema migration required for bundle kickoff
  - `track` cleanup is in scope for this task bundle, but executed in phased order rather than hard-deleted up front
- Backward compatibility:
  - Guidance should remain read-safe behind the existing flags while surface and copy migrate
  - Canonical item lifecycle must stay compatible across inbox / rail / bell / private receipt

## Consistency baseline for dual artifacts (if applicable)
- [x] Goal is aligned with current user decisions
- [x] Boundaries/non-goals are aligned with current user decisions
- [x] Archived guidance lineage is treated as historical context, not as current product truth
- [x] Task package is scoped for planning/governance first, not product code first
- Intentional divergences:
  - Divergence D1: archived V1 defined Guidance around dual-track onboarding; this roadmap explicitly rejects that as the current baseline

## Semantic reset target
### From
- Guidance = onboarding / dual entry / two tracks / teaching-first homepage explainer

### To
- Guidance = lifecycle continuation system
- Homepage right rail default = “my agents”
- Guidance rail = conditional takeover surface for next best action, payoff, and continuation
- User framing = multi-line engagement by default, not mode selection

## Resolved decisions
### Q1 — `track` migration policy
- Decision:
  - `explained_two_tracks` enters direct removal scope in this task.
  - `current_track` becomes non-authoritative immediately.
  - `T-974` must complete the full three-phase `track` retirement inside this task bundle, not in a separate future package.
- Three-phase execution baseline:
  1. Semantic retirement
     - Remove `track` and dual-entry semantics from product framing, summary presentation, right rail IA, copy, docs, and telemetry naming.
     - Stop treating `track` as user-facing truth.
  2. Internal de-dependency
     - Rewrite checklist, orchestrator branches, and summary composition to use fact signals directly:
       - `followed_first_agent_at`
       - `following_feed_seen_at`
       - `agent_created_at`
       - `private_session_created_at`
       - `nurture_receipt_ready_at`
       - `watch_public_effect_at`
     - `current_track` may remain stored temporarily, but no runtime decision should require it.
  3. Physical cleanup
     - Remove `GuidanceTrack`, `current_track`, `explained_two_tracks`, residual tests, seeds, API fields, and persistence mappings once phase 2 is complete.
- Why:
  - Hard-deleting `track` immediately would entangle semantic reset with broad mechanical cleanup.
  - The durable business facts already exist independently; `track` is now a historical compression layer rather than the right long-term contract.
- Constraint:
  - This phased migration is part of `T-974` scope end-to-end. “Phase later” means later in this same task, not a separate follow-up task.

### Q2 — `summary.modules[]` taxonomy policy
- Decision:
  - `DUAL_ENTRY` enters removal scope.
  - `CHECKLIST / CARD / RECEIPT` remain the active canonical module primitives for this task.
  - No new top-level `summary.modules[]` taxonomy will be introduced in this task unless a later implementation-phase contradiction is proven.
- Composition rule:
  - Innovation moves to stage-aware assembly and presentation, not to API enum expansion.
  - `ShellRightRail` and related composition logic decide:
    - which module becomes the primary stage card
    - which checklist items appear as secondary next actions
    - which `CARD` / `RECEIPT` becomes continuation or payoff
- Why:
  - The current UX problem is caused by module composition and always-on dual-entry semantics, not by insufficient primitive types.
  - Adding new module enums now would enlarge the backend/frontend/test compatibility surface without solving the real problem.
  - Keeping the canonical taxonomy small reduces migration risk while Q1's three-phase `track` retirement is still in flight.
- Allowed fallback:
  - If implementation later proves the current primitives insufficient, prefer optional presentation metadata over a new top-level module enum.
  - Candidate metadata examples: `priority`, `surface_hint`, `presentation_role`, `stage_affinity`.
  - This fallback is not approved by default and requires explicit re-evaluation inside `T-974`.

### Rail responsibility model
- Decision:
  - The long-term preferred right rail remains the current “my agents” interface.
  - Guidance does not permanently share the rail; it takes over the rail only when trigger conditions are met.
  - Once the trigger is handled, dismissed, or no longer relevant, the rail returns to “my agents”.
- Trigger rule:
  - Guidance rail may take over when:
    - the user has no agents
    - a fresh high-priority primary item appears
    - another explicitly approved lifecycle trigger occurs
- Operational interpretation:
  - We no longer need to force a named `quiet rail` / `active rail` model for guidance.
  - The key distinction becomes:
    - default `my agents` rail
    - triggered `guidance` rail
  - Collapsed/expanded behavior remains one control surface.

### Guidance takeover whitelist (V1)
- Approved V1 trigger reasons:
  1. `NO_AGENT_BOOTSTRAP`
     - condition:
       - authenticated user
       - `agent_count == 0`
       - no higher-priority takeover reason is active
       - homepage/feed surface only
     - rationale: the default “my agents” rail has no real long-term body to show yet
  2. `UNREAD_RECEIPT_READY`
     - condition:
       - an active `RECEIPT` item exists
       - `unread == true`
       - the item is still within a freshness window
       - no higher-priority takeover reason is active
     - rationale: strongest payoff signal; worthy of interrupting the default rail
  3. `FIRST_PRIVATE_CHAT_BLOCKER`
     - condition:
       - `agent_created_at` exists
       - `latest_owner_agent_id` exists
       - `private_session_created_at` is still null
       - no higher-priority takeover reason is active
       - homepage/feed surface only
     - rationale: strongest owner-loop blocker after agent creation
  4. `PUBLIC_EFFECT_READY`
     - condition:
       - an active `WATCH_PUBLIC_EFFECT`-style item exists
       - the item has a valid target (`target_url` or equivalent post linkage)
       - `watch_public_effect_at` is still null
       - the item is still within a freshness window
       - no higher-priority takeover reason is active
     - rationale: strongest follow-through signal after receipt/payoff
- Deferred / not in V1 whitelist:
  - `FOLLOWING_FEED_NUDGE`
    - keep as a possible later-phase candidate, but do not let it take over the rail in V1
  - `FOLLOWED_AGENT_STORY_ESCALATED`
    - keep inside normal surfaces / notifications first; do not elevate to rail takeover by default
  - generic unfinished checklist items
  - routine agent activity updates
- Priority order:
  1. `NO_AGENT_BOOTSTRAP`
  2. `UNREAD_RECEIPT_READY`
  3. `FIRST_PRIVATE_CHAT_BLOCKER`
  4. `PUBLIC_EFFECT_READY`
- Trigger principle:
  - only one takeover reason should win at a time
  - takeover requires “worthy interruption”, not mere content availability
  - a higher-priority reason may override a lower-priority reason even if the lower-priority reason is snoozed

### V1 trigger implementation guidance
- `FIRST_PRIVATE_CHAT_BLOCKER`
  - preferred first trigger timing:
    - trigger once on the first meaningful return to homepage/feed after agent creation
  - avoid:
    - permanently re-taking over the rail on every visit with no cooldown
  - recommended snooze behavior:
    - rail-level snooze only
    - do not mark the underlying guidance item as completed
- `NO_AGENT_BOOTSTRAP`
  - keep the condition structurally simple:
    - do not require extra engagement thresholds, dwell time, or prior content interactions
  - exit:
    - user creates the first agent
    - or user chooses `稍后再看`
- `UNREAD_RECEIPT_READY`
  - recommended freshness rule:
    - 72-hour freshness window
  - a receipt should stop taking over the rail when any of the following is true:
    - the receipt is opened/consumed
    - the canonical item is completed or dismissed
    - the freshness window expires
    - the current rail-level snooze window is still active
- `PUBLIC_EFFECT_READY`
  - recommended freshness rule:
    - use a freshness window so stale public-effect items do not keep re-taking over the rail
  - recommended default:
    - 72-hour freshness window unless implementation evidence suggests a better value
  - recommended snooze behavior:
    - rail-level snooze only
    - preserve the underlying canonical item in inbox/bell/other surfaces

### V1 snooze duration matrix
- `NO_AGENT_BOOTSTRAP`
  - default snooze: 24 hours
- `UNREAD_RECEIPT_READY`
  - default snooze: 12 hours
- `FIRST_PRIVATE_CHAT_BLOCKER`
  - default snooze: 24 hours
- `PUBLIC_EFFECT_READY`
  - default snooze: 12 hours
- Shared rule:
  - snooze only suppresses rail takeover for the same reason
  - snooze does not alter inbox/bell visibility or canonical item lifecycle

## Coverage audit against confirmed goals
| Confirmed goal / decision | Covered in bundle? | Primary doc anchor | Planned implementation slice |
|---|---|---|---|
| 完全移除 dual entry 语义 | yes | `Q1`, `Q2`, contract migration policy | S2, S4, S5 |
| 右 rail 不占主视觉，默认仍是“查看我的智能体” | yes | `Rail responsibility model`, `Guidance-rail exit policy` | S3 |
| 不再使用“看戏 / 养成”双轨作为主叙事 | yes | `Semantic reset target`, `C3`, copy/contract cleanup notes | S2, S5 |
| Guidance 只在明确条件下 takeover，并支持 `稍后再看` | yes | `Guidance takeover whitelist (V1)`, `Rail-snooze state policy (V1)` | S1, S3 |
| `稍后再看` 只做 rail-level snooze，本地 authoritative | yes | `Rail-snooze state policy (V1)` | S1, S3 |
| `track` 三阶段退场且都在本任务内完成 | yes | `Q1 — track migration policy` | S2, S4, S5 |
| 不扩张 `summary.modules[]` 顶层 taxonomy | yes | `Q2 — summary.modules[] taxonomy policy` | S2 |
| 不改动现有“查看我的智能体”主界面 UIUX | yes | `Rail responsibility model`, non-goals | S3 |
| 任务包要能直接支撑实施 | yes | `Execution-ready implementation slices`, verification section | S1-S6 |

## Execution-ready implementation slices
### S1 — Contract bridge and event-scaffold slice
- Objective:
  - 冻结 rail takeover 的内部合同、`稍后再看` 的本地状态模型，以及 backend observability 事件契约。
- Primary files/modules:
  - `src/backend/guidance/guidance-events.ts`
  - `src/backend/routes/guidance-api.ts`
  - `src/backend/routes/__tests__/guidance-api.test.ts`
  - `src/frontend/api/types.ts`
  - `src/frontend/api/hooks/guidance.ts`
  - new frontend rail helper files if extracted under `src/frontend/features/guidance/rail/*`
- Scope:
  - add `GUIDANCE_TAKEOVER_SNOOZED` event acceptance
  - freeze local snooze record shape and scope-key rules
  - freeze rail internal mode/candidate contract without expanding `summary.modules[]`
- Exit criteria:
  - no product-visible rail flip yet
  - telemetry/event contract exists and is test-covered
  - new frontend code has a stable internal type surface for takeover evaluation

### S2 — Backend summary-composition reset slice
- Objective:
  - 用 fact-driven composition 替换 `DUAL_ENTRY` 和 `track` 驱动的 summary 结构。
- Primary files/modules:
  - `src/backend/guidance/guidance-state-service.ts`
  - `src/backend/guidance/guidance-copy-service.ts`
  - `src/backend/guidance/guidance-types.ts`
  - `src/backend/guidance/reason-codes.ts`
  - backend guidance/service tests
- Scope:
  - stop unconditional `DUAL_ENTRY` emission
  - rewrite checklist composition to facts, not `current_track`
  - keep `current_track` / `explained.two_tracks` only as compatibility output during bridge period
  - close retained-stage rule: no generic checklist-driven retained takeover
- Exit criteria:
  - `GET /guidance/summary` no longer needs `DUAL_ENTRY`
  - `ShellRightRail` can derive takeover solely from actor facts + `CHECKLIST/CARD/RECEIPT` + my-agents data

### S3 — Frontend rail takeover slice
- Objective:
  - 将首页右 rail 切为“默认我的智能体 + Guidance 条件接管”。
- Primary files/modules:
  - `src/frontend/widgets/shell/ShellRightRail.tsx`
  - `src/frontend/widgets/shell/__tests__/ShellRightRail.test.tsx`
  - new takeover/snooze helpers under `src/frontend/features/guidance/rail/*` if extracted
- Scope:
  - build takeover selector from summary + myAgents + snooze store
  - default mode remains `MY_AGENTS`
  - apply V1 whitelist and priority order
  - support `稍后再看` -> local snooze + client event + immediate return
- Exit criteria:
  - no dual-entry UI remains in rail
  - no new “quiet rail” steady-state product concept is introduced
  - rail returns to unchanged “my agents” view when no active reason survives

### S4 — Internal track de-dependency slice
- Objective:
  - 让 runtime 决策完全摆脱 `current_track` / `explained_two_tracks`。
- Primary files/modules:
  - `src/backend/guidance/guidance-orchestrator.ts`
  - `src/backend/guidance/guidance-state-service.ts`
  - `src/backend/guidance/__tests__/guidance-recall-scheduler.test.ts`
  - `src/backend/services/__tests__/guidance-orchestrator.test.ts`
- Scope:
  - stop writing `current_track` as authoritative state transition
  - stop reading `current_track` inside checklist/orchestrator/summary runtime branches
  - ensure stage derivation and recall policy remain fact-driven
- Exit criteria:
  - no runtime branch requires `GuidanceTrack`
  - compatibility fields may still exist physically, but they are dead data

### S5 — Physical cleanup and schema/type cleanup slice
- Objective:
  - 完成 `track` / dual-entry 物理删除，收口 repo/runtime/schema/docs。
- Primary files/modules:
  - `src/backend/repos/types/guidance.ts`
  - `src/backend/repos/pg/pg-guidance-state-repository.ts`
  - `src/backend/guidance/guidance-types.ts`
  - `src/frontend/api/types.ts`
  - `prisma/schema.prisma`
  - `docs/context/db/schema.json`
  - relevant migrations, seeds, tests, dev-docs references
- Scope:
  - remove `GuidanceTrack`, `current_track`, `explained_two_tracks`
  - remove `HOME_DUAL_ENTRY`, `DUAL_ENTRY`, dual-entry copy/event names
  - remove stale fixtures/tests/telemetry references
  - if DB columns are dropped, use repo DB workflow to generate migration and refresh DB context
- Exit criteria:
  - `rg` over guidance contracts no longer finds product/runtime uses of dual-entry or track fields
  - schema, repo types, API types, tests, and docs agree on the final contract

### S6 — Verification and governance closure slice
- Objective:
  - 用统一验证矩阵收口实现、文档和治理状态。
- Primary files/modules:
  - `dev-docs/active/guidance-stage-rail-lifecycle-and-semantic-alignment/04-verification.md`
  - `.ai/project/main/*`
  - targeted backend/frontend test suites
- Scope:
  - execute planned checks
  - verify docs/project-hub consistency
  - record rollout/backout notes with the final contract
- Exit criteria:
  - verification matrix is complete
  - task bundle can be used as the execution SoT without reopening roadmap semantics

## Project structure change preview (may be empty)
### Existing areas likely to change (may be empty)
- Modify:
  - `src/backend/guidance/guidance-types.ts`
  - `src/backend/guidance/guidance-state-service.ts`
  - `src/backend/guidance/guidance-copy-service.ts`
  - `src/backend/guidance/reason-codes.ts`
  - `src/frontend/widgets/shell/ShellRightRail.tsx`
  - `src/frontend/api/types.ts`
  - `src/frontend/widgets/shell/__tests__/ShellRightRail.test.tsx`
  - project/dev-docs references that still describe guidance as dual-entry onboarding
- Delete:
  - obsolete dual-entry specific code paths, tests, and docs
- Move/Rename:
  - no mandatory file moves expected at planning stage

### New additions (landing points) (may be empty)
- New documentation artifacts:
  - this task bundle
- New implementation files:
  - TBD only if the chosen redesign introduces extracted rail composition helpers or lifecycle mappers

## Phases
1. **Phase 1**: Semantic reset and governance alignment
   - Deliverable: a frozen product-semantic decision for “Guidance Lifecycle” replacing “Guidance & Onboarding V1” as the active baseline.
   - Acceptance criteria:
     - roadmap records the new baseline
     - archived lineage and current task scope are explicitly separated
     - dual-entry retirement scope is enumerated
     - `explained_two_tracks` and `current_track` are formally marked non-baseline
2. **Phase 2**: Lifecycle contract alignment and internal de-dependency
   - Deliverable: stage-by-stage lifecycle definition plus migration policy for summary modules, reason codes, and canonical items.
   - Acceptance criteria:
      - each stage has clear rail goals
      - `DUAL_ENTRY` removal and retained primitive set are frozen
      - fact-driven replacement logic for former `track` branches is documented
      - compatibility policy for `current_track`, `reason_code`, and `summary.modules[]` is documented
3. **Phase 3**: Right rail UX redesign plan
   - Deliverable: concrete right rail IA and interaction spec, including collapsed/expanded behavior.
   - Acceptance criteria:
     - rail does not read like a tutorial
     - hierarchy between primary card, next-step cards, and continuation/payoff is clear
     - stronger but low-noise toggle entry is defined
4. **Phase 4**: Physical cleanup, rollout plan, and verification closure
   - Deliverable: implementation slices, final `track` removal checklist, verification matrix, and cleanup sequence.
   - Acceptance criteria:
      - backend/frontend/docs/telemetry cleanup order is documented
      - schema/type/test cleanup gate for `track` retirement is explicit
      - rollout/backout path is explicit
      - governance sync and archived-doc drift checks are included

## Implementation sequencing rule
- Recommended order:
  1. S1 Contract bridge
  2. S2 Backend summary-composition reset
  3. S3 Frontend rail takeover
  4. S4 Internal track de-dependency
  5. S5 Physical cleanup and schema/type cleanup
  6. S6 Verification and governance closure
- Constraint:
  - S3 MUST NOT ship before S2 has removed the unconditional `DUAL_ENTRY` dependency from summary.
  - S5 MUST NOT start until S4 proves runtime is no longer reading or writing `current_track` as an authoritative decision input.
  - DB schema removal for `current_track` / `explained_two_tracks` MUST be handled in S5 through the repo DB SSOT workflow, not ad-hoc SQL edits.

## Step-by-step plan (phased)

### Phase 1 — Semantic reset and governance alignment
- Objective: stop treating V1 dual-track onboarding as the current product contract.
- Deliverables:
  - semantic glossary for the new task
  - explicit “from/to” mapping for retired concepts
  - lineage note linking `T-974` to archived `T-077..T-080`
  - formal deprecation note for `explained_two_tracks` and `current_track`
- Verification:
  - review roadmap for retired terms coverage
  - governance sync/lint passes after bundle creation
- Rollback:
  - keep task bundle planned but do not apply product code changes

### Phase 2 — Lifecycle contract alignment and internal de-dependency
- Objective: define how Guidance works across the full user lifecycle without dual entry.
- Deliverables:
  - stage definitions
  - per-stage rail objective and module priority
  - canonical item and surface-variant rules
  - former `track` branches rewritten as fact-driven decision rules
  - retained `CHECKLIST / CARD / RECEIPT` primitive usage rules
- Verification:
  - roadmap checklist review against `NEW_VISITOR / EXPLORING / FIRST_SUCCESS / RETAINED`
  - checklist/orchestrator/summary decision table no longer requires `current_track`
  - no new top-level module enum introduced by default
- Rollback:
  - defer implementation until contract questions are resolved

### Phase 3 — Right rail UX redesign plan
- Objective: redesign the rail as a continuation surface, not a tutorial surface.
- Deliverables:
  - expanded state IA
  - collapsed state IA
  - naming/copy direction for the toggle and section labels
  - do-not-do list for tutorial tone, dual-track framing, and visual weight
- Verification:
  - qualitative review against archived `guidance-web-core-experience` pitfalls
- Rollback:
  - preserve current rail while iterating on IA in docs only

### Phase 4 — Physical cleanup, rollout plan, and verification closure
- Objective: complete the retirement by removing residual compatibility after fact-driven logic lands.
- Deliverables:
  - backend contract slice
  - frontend rail slice
  - telemetry/docs cleanup slice
  - final persistence/type/test cleanup slice for `track`
  - verification matrix
- Verification:
  - each slice has explicit tests/checks/manual scenarios
  - no remaining product/runtime dependency on `current_track` or `explained_two_tracks`
- Rollback:
  - ability to ship partial cleanup behind the existing guidance master flag if needed

## Right rail target IA (draft baseline for discussion)
- Expanded:
  - one optional primary stage card
  - up to two optional secondary actions
  - one optional continuation/payoff block
  - low-noise utility footer
- Collapsed:
  - a clearly visible control, stronger than a plain text link
  - optional one-line status summary, not a hidden tutorial label
- Tone:
  - no “现在可以这样开始” style explainer headers
  - no “看戏 / 养成” binary labels
  - copy should point to current continuation, not mode selection

## Rail assembly baseline
### Canonical module roles
- `CHECKLIST`
  - canonical meaning: current-stage next actions
  - preferred rail usage: decomposed into secondary action items rather than rendered as a large tutorial block
- `CARD`
  - canonical meaning: flexible continuation, reminder, or escalation item
  - preferred rail usage: primary stage card or continuation card
- `RECEIPT`
  - canonical meaning: payoff and closed-loop feedback
  - preferred rail usage: highest-priority primary card candidate; otherwise continuation/payoff card

### Fixed guidance-rail slots
- Primary slot
  - role: the single most important “what to do / what just changed now” message
  - content: optional
- Secondary-actions slot
  - role: up to two next actions
  - content: optional
- Continuation slot
  - role: recent payoff, escalation, or follow-on clue
  - content: optional
### Guidance-rail trigger conditions
- No agents / bootstrap state
- Fresh primary guidance content becomes available
  - e.g. unread `RECEIPT`
  - high-priority lifecycle `CARD`
  - newly elevated next-best action
- Other trigger conditions must be explicit and finite; guidance should not become the permanent resting interface

### Assembly rules
1. Primary slot selection
   - Prefer unread or high-priority `RECEIPT`
   - Otherwise prefer the highest-priority `CARD`
   - Otherwise elevate the first unfinished checklist item into primary-card treatment
   - Otherwise leave the primary slot empty
2. Secondary-actions slot selection
   - Source only from unfinished checklist items
   - Maximum two items
   - Do not duplicate an action already promoted to the primary slot
3. Continuation slot selection
   - Prefer `CARD` or `RECEIPT` that expresses payoff, public effect, or story escalation
   - If the primary slot is already a `RECEIPT`, continuation should prefer `WATCH_PUBLIC_EFFECT` or equivalent escalation/continuation item
   - If no meaningful continuation exists, leave the slot empty
4. Guidance-rail exit fallback
   - If the trigger condition is no longer meaningful, the rail should exit back to the default “my agents” view instead of inventing filler cards

### Stage-aware assembly targets
- `NEW_VISITOR`
  - Prefer a light `CARD` in primary
  - Secondary slot is usually empty or contains at most one action
  - Continuation slot should usually be empty
- `EXPLORING`
  - Prefer promoting the first unfinished checklist item into primary
  - Use remaining checklist items for secondary actions
  - Continuation is optional if an early payoff already exists
- `FIRST_SUCCESS`
  - Prefer `RECEIPT` in primary
  - Secondary slot can hold one or two continuation-oriented next actions
  - Continuation should prefer public-effect or escalation-style `CARD`
- `RETAINED`
  - Prefer continuation/escalation `CARD` or fresh `RECEIPT` in primary when available
  - Secondary checklist usage should be minimal by default
  - If no meaningful guidance interruption remains, return to the default “my agents” view

## Guidance-rail exit policy
- Guidance rail should be temporary by design.
- Expected exit paths:
  - user completes or opens the primary guidance item
  - user dismisses/snoozes the current guidance interruption
  - trigger condition expires or is no longer the highest-priority rail use
  - user explicitly returns to the default rail
- Exit result:
  - rail returns to the unchanged “my agents” interface
- Constraint:
  - guidance should not linger as a low-value empty shell after its reason for takeover disappears
- UX rule:
  - automatic return and explicit return should coexist in V1
- V1 explicit exit copy:
  - use `稍后再看`
- `稍后再看` semantics:
  - exit the current Guidance takeover
  - return to the default “my agents” rail
  - apply a short rail-level snooze to the current takeover reason
  - do not mark the canonical guidance item as completed
  - do not permanently dismiss the underlying guidance item
  - V1 authority lives in frontend local persistence, not backend canonical guidance state

### Rail-snooze state policy (V1)
- Authoritative storage:
  - frontend local persistence (`localStorage`)
- Non-authoritative backend behavior:
  - emit an observability/client event only
  - do not persist rail-snooze as canonical guidance lifecycle state
- Why:
  - rail takeover snooze is a surface-level display preference, not a cross-surface completion/dismissal fact
  - keeping it local prevents pollution of inbox/bell/receipt lifecycle semantics
  - multi-device synchronization is not required for V1
- Suggested local record shape:
  - `actor_id`
  - `reason`
  - `scope_key`
  - `expires_at`
- Suggested scope-key strategy:
  - `NO_AGENT_BOOTSTRAP` -> `global`
  - `UNREAD_RECEIPT_READY` -> `receipt:<item_id>` or `session:<session_id>`
  - `FIRST_PRIVATE_CHAT_BLOCKER` -> `agent:<agent_id>`
  - `PUBLIC_EFFECT_READY` -> `post:<post_id>` or `watch:<item_id>`
- Suggested localStorage partitioning:
  - user/actor scoped key, e.g. `guidance-rail-snooze:<actor_id>`
- Suggested analytics event:
  - `GUIDANCE_TAKEOVER_SNOOZED`
  - payload should include `reason`, `scope_key`, `expires_at`, and `surface`

## Verification and acceptance criteria
- Governance:
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
- Documentation:
  - roadmap and bundle files cover semantic reset, lifecycle, rail IA, and execution slicing
  - no blocking roadmap question remains open
- Future implementation verification targets:
  - backend guidance tests for summary module composition
  - frontend rail tests for trigger-based takeover and collapsed/expanded behavior
  - cleanup verification proving no remaining runtime dependency on `GuidanceTrack`
  - contract verification proving `summary.modules[]` no longer exposes `DUAL_ENTRY`
  - rail-mode verification proving default returns to “my agents” when no valid guidance trigger remains
  - targeted manual review for retained-stage non-tutorial behavior

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| Dual-entry semantics remain in backend contract after UI cleanup | high | high | Retire by matrix, not by copy-only changes | Contract review + tests | Keep task planned until matrix is complete |
| Guidance becomes too weak after de-tutorialization | med | med | Preserve stage card + payoff loop instead of empty rail | Manual review with stage scenarios | Reintroduce compact stage cues without mode framing |
| Rail redesign causes inbox/bell/private receipt drift | med | high | Keep canonical item lifecycle unchanged | Cross-surface verification matrix | Stop at docs/contract stage before code rollout |
| Governance docs continue to use onboarding V1 as active semantic baseline | med | med | Explicitly mark archived lineage and new baseline in roadmap/bundle | Project doc review | Update docs before implementation starts |

## Optional detailed documentation layout (convention)
```
dev-docs/active/guidance-stage-rail-lifecycle-and-semantic-alignment/
  roadmap.md
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
  .ai-task.yaml
```

## To-dos
- [x] Create a new task bundle instead of reusing archived guidance V1 bundles
- [x] Record the semantic reset target and user-confirmed constraints
- [x] Define roadmap phases covering semantics, lifecycle, rail UX, and rollout
- [ ] Align open questions in roadmap discussion
- [ ] Start implementation only after roadmap alignment
