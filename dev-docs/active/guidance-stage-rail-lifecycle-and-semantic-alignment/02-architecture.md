# 02 Architecture

## Context & current state
- 当前 Guidance 的 authoritative runtime 仍在 `guidance_actor_states`、`guidance_inbox`、`guidance_event_log` 与 `summary.modules[]` contract。
- 首页右 rail 当前承担了三类职责：
  - 用 dual entry 解释产品玩法；
  - 用 checklist 推动下一步；
  - 用 receipt / item 承接 payoff。
- 这导致一个结构性问题：教程表达、阶段推进和长期 continuation 被混在同一个 surface 中，且 dual entry 对所有 actor 常驻。

## Proposed design

### Core semantic shift
- 从 `Guidance & Onboarding` 切换为 `Guidance Lifecycle`.
- 从 `dual-track onboarding` 切换为 `stage-driven continuation`.
- 从“用户先选玩法”切换为“系统根据阶段给出当前最相关的继续动作与 payoff”.

### Surface model
- 首页继续保留右 rail；其默认 steady-state surface 是现有“查看我的智能体”界面。
- 右 rail 不负责承担首页主视觉，不与 programming shelves 或主 feed 争夺首屏焦点。
- Guidance rail 不再被定义为长期共享 surface，而是一个条件触发的 takeover surface。
- Guidance rail 的展示结构统一为：
  - 当前阶段主卡（可选）
  - 1 到 2 个次级建议（可选）
  - 最近 payoff / continuation（可选）
  - 明确但低干扰的展开/收起控制

### Lifecycle contract
- `NEW_VISITOR`
  - 目标：建立最低限度的阅读和互动理解。
  - rail 重点：轻量起步，而不是产品模式说明。
- `EXPLORING`
  - 目标：推动用户完成第一组有效动作。
  - rail 重点：下一步和短反馈。
- `FIRST_SUCCESS`
  - 目标：让用户感知“我刚刚造成了变化”。
  - rail 重点：receipt / public effect / immediate continuation。
- `RETAINED`
  - 目标：从教学切到持续使用。
  - rail 重点：recent continuation、升级事件、长期线索。

### Contract migration policy
- `GuidanceDualEntryModule` 和 `HOME_DUAL_ENTRY` 是本轮优先退场对象。
- `explained_two_tracks` 在本任务中直接进入删除范围。
- `current_track` 采用三阶段退场策略，且三阶段都属于本任务范围：
  1. 从产品语义、summary surface、文案和 telemetry 中退场；
  2. 从 checklist、orchestrator、summary composition 的运行时决策中退场；
  3. 从类型、持久层、seed、tests 和 API 输出中物理删除。
- 在 Phase 2 完成前，`current_track` 允许作为短期兼容字段存在；但它不再是任何新设计的 authoritative input。
- `summary.modules[]` 采用最小 primitive 策略：
  - remove: `DUAL_ENTRY`
  - retain: `CHECKLIST`, `CARD`, `RECEIPT`
  - avoid by default: new top-level module enums
- 新 rail 的结构变化通过 stage-aware composition 完成，而不是通过扩展 canonical module taxonomy 完成。
- Guidance rail 的结构目标固定为三槽：
  - primary slot
  - secondary-actions slot
  - continuation slot
- inbox、bell、private receipt 仍必须消费 canonical guidance item，不允许为新 rail 另造一套 item 生命周期。

### Canonical contract closure
- `GET /v1/guidance/summary` MUST remain the single summary entrypoint for right-rail Guidance in V1.
- `summary.modules[]` MUST remain limited to:
  - `CHECKLIST`
  - `CARD`
  - `RECEIPT`
- `summary.modules[]` MUST stop emitting `DUAL_ENTRY` once S2 lands.
- `GuidanceActorView.current_track` and `explained.two_tracks` SHOULD be treated as deprecated compatibility fields from S1 onward.
- New rail behavior MUST NOT require a new REST endpoint or a parallel inbox lifecycle.

### Frontend internal rail contract
- To avoid expanding the canonical API unnecessarily, V1 SHOULD introduce an internal frontend selector contract rather than a new top-level summary module enum.
- Suggested internal types:

```ts
type GuidanceRailMode = 'MY_AGENTS' | 'GUIDANCE'

type GuidanceRailTakeoverReason =
  | 'NO_AGENT_BOOTSTRAP'
  | 'UNREAD_RECEIPT_READY'
  | 'FIRST_PRIVATE_CHAT_BLOCKER'
  | 'PUBLIC_EFFECT_READY'

interface GuidanceRailSnoozeRecord {
  reason: GuidanceRailTakeoverReason
  scope_key: string
  expires_at: string
}

interface GuidanceRailTakeoverCandidate {
  reason: GuidanceRailTakeoverReason
  priority: number
  scope_key: string
  source_item_id: string | null
  primary: 'CHECKLIST' | 'CARD' | 'RECEIPT' | null
  secondary_action_reason_codes: string[]
  continuation_item_id: string | null
}
```

- Contract intent:
  - the selector MAY read canonical summary modules and `useMyAgents()` data
  - the selector MUST apply local snooze suppression before choosing `GUIDANCE`
  - the selector MUST NOT read `current_track` or `explained.two_tracks`

### Rail composition policy
- The rail slots are presentation roles, not new canonical module types.
- A given canonical module may map to different slots depending on stage and priority.
- Default mapping guidance:
  - `RECEIPT`: primary first, continuation second
  - `CARD`: primary or continuation
  - `CHECKLIST`: decompose into action items for secondary slot; optionally elevate the first unfinished item into primary treatment
- The system must allow all content slots to be empty at the same time.
- When all guidance slots are empty or the trigger no longer justifies takeover, the rail exits back to “my agents”.
- Guidance-rail priority remains:
  - fresh payoff > urgent lifecycle continuation > next actions

### Rail mode policy
- Default mode: `MY_AGENTS`
- Takeover mode: `GUIDANCE`
- Guidance enters only on explicit trigger conditions.
- V1 approved trigger whitelist:
  - `NO_AGENT_BOOTSTRAP`
  - `UNREAD_RECEIPT_READY`
  - `FIRST_PRIVATE_CHAT_BLOCKER`
  - `PUBLIC_EFFECT_READY`
- V1 trigger specifics:
  - `NO_AGENT_BOOTSTRAP`
    - requires authenticated user
    - requires zero owned agents
    - should remain a structurally simple bootstrap rule, not an engagement-scored rule
  - `UNREAD_RECEIPT_READY`
    - requires active receipt item
    - requires `unread == true`
    - requires freshness window validity
  - `FIRST_PRIVATE_CHAT_BLOCKER`
    - requires `agent_created_at`
    - requires `latest_owner_agent_id`
    - requires `private_session_created_at == null`
    - should trigger as a short-lived blocker reminder, not a permanently sticky mode
  - `PUBLIC_EFFECT_READY`
    - requires active watch-public-effect guidance item
    - requires unresolved `watch_public_effect_at`
    - requires valid navigation target
    - should respect a freshness window so stale items do not repeatedly take over the rail
- V1 non-takeover set:
  - `FOLLOWING_FEED_NUDGE`
  - `FOLLOWED_AGENT_STORY_ESCALATED`
  - generic unfinished checklist items
  - routine agent activity updates
- Guidance exits when:
  - the triggering content is handled, dismissed, or consumed
  - the trigger is no longer current
  - the user explicitly returns to the default rail
- No separate long-lived “quiet guidance mode” is required as a named product concept.
- Automatic return and explicit return both exist in V1.
- Explicit return copy:
  - `稍后再看`
- `稍后再看` behavior:
  - acts as rail-level snooze
  - returns the surface to `MY_AGENTS`
  - does not complete or permanently dismiss the underlying canonical guidance item
- V1 default snooze matrix:
  - `NO_AGENT_BOOTSTRAP`: 24h
  - `UNREAD_RECEIPT_READY`: 12h
  - `FIRST_PRIVATE_CHAT_BLOCKER`: 24h
  - `PUBLIC_EFFECT_READY`: 12h
- V1 snooze authority:
  - authoritative in frontend local persistence only
  - backend receives event telemetry only
- Suggested persistence contract:
  - key namespace scoped by actor, e.g. `guidance-rail-snooze:<actor_id>`
  - record fields: `reason`, `scope_key`, `expires_at`
- Suggested backend event contract:
  - client event `GUIDANCE_TAKEOVER_SNOOZED`
  - purpose: observability/debugging
  - non-purpose: canonical lifecycle control

### Retained-stage closure
- `RETAINED` MUST NOT use generic checklist items as the default reason to take over the right rail.
- `RETAINED` MAY still expose canonical checklist data transiently during bridge phases, but that data is non-authoritative for rail takeover.
- `RETAINED` takeover SHOULD be limited to whitelist continuation/payoff reasons:
  - fresh `RECEIPT`
  - `PUBLIC_EFFECT_READY`
  - any later-approved whitelist continuation reason
- Result:
  - retained behavior is now implementation-ready and no longer blocked by Q4.

### End-to-end execution flow
1. Domain events update actor facts and inbox items through `GuidanceOrchestrator`.
2. `GuidanceStateService` builds canonical summary from facts and active items.
3. The frontend loads:
   - `useGuidanceSummary()`
   - `useMyAgents()`
   - local snooze state from `localStorage`
4. A local rail selector derives the highest-priority takeover candidate.
5. `ShellRightRail` chooses:
   - `MY_AGENTS` when no candidate survives
   - `GUIDANCE` when a whitelist candidate survives snooze and priority checks
6. When the user clicks `稍后再看`:
   - write/update the local snooze record
   - emit `GUIDANCE_TAKEOVER_SNOOZED`
   - switch the rail back to `MY_AGENTS`
7. When the user opens/completes the primary item:
   - canonical item status changes as before
   - the selector re-evaluates
   - the rail returns to `MY_AGENTS` if no active takeover reason remains

## Interfaces & contracts
- Candidate backend contracts to review:
  - `GuidanceSummaryModule`
  - `GuidanceReasonCode`
  - `GuidanceCopyService`
  - Guidance telemetry event taxonomy
- Candidate frontend contracts to review:
  - `ShellRightRail`
  - Guidance feature flags and visibility rules
  - Agent modal / private channel / inbox 对 Guidance 的 surface 依赖

## Boundaries & dependency rules
- Allowed:
  - 调整 Guidance 的产品语义、summary module 组合策略、首页右 rail IA、文案层、验证矩阵和治理文档。
  - 在不扩张 top-level module enum 的前提下，为现有 module 增加必要的 presentation/composition metadata 候选讨论。
- Forbidden:
  - 新建一条平行的 onboarding contract；
  - 让 retained 态仍默认展示教程式头部；
  - 通过首页 rail 再次引入“看戏 / 养成”二选一叙事。
  - 在没有明确必要性的前提下扩张 `summary.modules[]` 顶层 taxonomy。

## Data migration (if applicable)
- 预期先做“surface 与 contract 迁移”，不直接假设有 DB migration。
- `track` 相关清理不会被拆到另一个任务包：
  - 先完成 surface 与 contract 迁移；
  - 再完成 schema/analytics/type/test 清理切片。
- Current implementation evidence confirms that `current_track` and `explained_two_tracks` exist in:
  - `prisma/schema.prisma`
  - repo entity types / PG mappings
  - DB context contract
- Therefore S5 MUST include:
  - Prisma schema update
  - migration generation under repo DB SSOT
  - `docs/context/db/schema.json` refresh

## Non-functional considerations
- Product consistency:
  - 首页、inbox、bell、private receipt、inline payoff 必须继续共用同一语义底座。
- Surface discipline:
  - “查看我的智能体”保持长期默认地位，且当前 UIUX 暂不改动。
  - Guidance 只负责必要打断，不应膨胀成新的常驻主界面。
- Takeover discipline:
  - Guidance takeover must be whitelist-based.
  - “有内容可显示” does not equal “值得接管默认 rail”.
  - `FIRST_PRIVATE_CHAT_BLOCKER` and `PUBLIC_EFFECT_READY` must remain bounded by cooldown/freshness discipline rather than sticky persistence.
  - `NO_AGENT_BOOTSTRAP` and `UNREAD_RECEIPT_READY` must remain bounded by explicit structural/freshness checks rather than heuristic interpretation.
  - rail-snooze persistence must not alter inbox/bell/receipt state or shared backend summary semantics.
- Observability:
  - dual entry 退场后，旧 telemetry 名称和 dashboard 口径需要同步调整。
- Rollout:
  - guidance flag 仍保留为总开关；本轮不新增更多 surface-specific flags 作为长期方案。

## Open questions
- None blocking implementation.
- Non-blocking implementation choices:
  - rail selector helper是否抽到独立文件
  - `scope_key` 具体采用 `receipt:<item_id>` 还是 `session:<session_id>` 作为某些 reason 的首选粒度
