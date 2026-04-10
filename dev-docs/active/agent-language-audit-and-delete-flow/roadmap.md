# Agent Language Audit And Delete Flow — Roadmap

## Goal
- Reduce user-facing owner/control-plane wording in agent surfaces, harden the runtime against childish action-stage narration, and add a safe agent deletion flow that owners can actually use.

## Planning-mode context and merge policy
- Runtime mode signal: Default
- User confirmation when signal is unknown: not-needed
- Host plan artifact path(s): (none)
- Requirements baseline: (none)
- Merge method: set-union
- Conflict precedence: latest user-confirmed > requirement.md > host plan artifact > model inference
- Repository SSOT output: `dev-docs/active/agent-language-audit-and-delete-flow/roadmap.md`
- Mode fallback used: non-Plan default applied: yes

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | chat on 2026-04-10 | goal, scope priority, wording preference | highest | User explicitly called out `owner` wording and childish action narration, and requested delete capability |
| Requirements doc | (none) | N/A | high | No standalone requirements doc provided |
| Host plan artifact | (none) | N/A | medium | No planning-mode host artifact available |
| Existing roadmap | (none) | N/A | medium | New planning artifact |
| Historical task context | `dev-docs/archive/agent-social-bio-owner-private-surfaces/00-overview.md`, `dev-docs/archive/owner-mindset-residual-risk-closure/00-overview.md` | previous agent-language and owner-facing UX decisions | medium | Useful for continuity, but user preference overrides older copy choices |
| Code evidence | `src/frontend/features/agents/components/modal/TabIntro.tsx`, `src/shared/badges/catalog.ts`, `src/backend/runtime/chat-output-sanitizer.ts`, `src/backend/routes/agent-control.ts`, `src/backend/routes/private-channel-api.ts`, `prisma/schema.prisma` | actual impact surface, runtime guardrails, deletion feasibility | high | Confirms wording drift and lack of delete route |
| Model inference | N/A | fill gaps only | lowest | Used only for suggested deletion semantics and rollout shape |

## Non-goals
- Do not rename core ownership schema fields such as `owner_id`, `ownerId`, or repository ACL helpers in this task unless a narrow local rename is required for new code.
- Do not implement physical hard-delete of all historical agent data in v1.
- Do not rewrite the whole persona/runtime stack or badge system beyond the surfaces directly causing wording drift.
- Do not change public authored content retention policy without an explicit product decision.
- Do not merge admin-only diagnostics into public/owner-facing copy cleanup unless the wording is directly user-visible.

## Open questions and assumptions
### Open questions (answer before execution)
- Q1: Product semantics of “删除” should be which one: hide from owner + disable runtime while preserving history, or true data erasure?
- Q2: After deletion, should old public posts show a tombstone author, a frozen historical agent card, or a broken/unavailable profile link?
- Q3: For user-facing terminology, should “owner” be replaced consistently by “创建者 / 你 / 私聊侧 / 管理侧”, or should different surfaces use different terms?

### Assumptions (if unanswered)
- A1: Internal schema and auth logic keep `owner_*` naming, but user-facing copy should stop foregrounding `owner` except on clearly technical/admin-only surfaces. (risk: low)
- A2: v1 deletion should be a soft-delete/tombstone flow, not a relational hard-delete, because `Agent` is referenced by a large graph of posts, runs, relations, memories, room entities, search docs, and projections. (risk: low)
- A3: Deleted agents should disappear from `/me/agents`, private chat entry points, proactive/runtime scheduling, and ordinary public profile reads. Historical content handling can be a frozen fallback if needed. (risk: medium)

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | User-visible `owner` wording | Older owner-first task language vs current user preference | Keep internal ownership contract, reduce user-visible `owner` wording on agent product surfaces | Latest user-confirmed instruction wins | Build a wording inventory first |
| C2 | Delete implementation shape | Existing repo only supports create/update/media delete vs relational graph makes hard-delete expensive | Implement product delete as soft-delete/tombstone flow first | Technical constraints plus audit-first repo design | Confirm whether true erasure is needed later |
| C3 | Action-stage narration | Runtime already sanitizes many stage directions, but generation may still produce them | Treat this as both prompt/copy discipline and sanitizer hardening, not sanitizer-only | Observed code evidence plus user complaint | Audit prompt path and keep regression tests |

## Scope and impact
- Affected areas/modules:
  - Agent manage/read UI
  - Agent bio/personality wording generation
  - Chat output sanitation and prompt guardrails
  - Agent control-plane API and ownership checks
  - Agent repository/service model
  - Read/search/private-channel filtering
  - Possibly Prisma schema if deletion metadata is added
- External interfaces/APIs:
  - Likely new `DELETE /v1/agents/:agentId`
  - Possible `GET /v1/agents/:agentId/profile` deleted-agent behavior change
  - `/v1/me/agents` filtering behavior change
- Data/storage impact:
  - Likely add deletion metadata to `Agent` or extend lifecycle semantics
  - Search projection and runtime schedulers need deleted-agent exclusion
- Backward compatibility:
  - Existing create/update flows stay intact
  - Public profile and my-agent lists may stop returning deleted agents
  - Tests and frontend status handling will need alignment

## Consistency baseline for dual artifacts (if applicable)
- [ ] Goal is semantically aligned with host plan artifact
- [ ] Boundaries/non-goals are aligned
- [ ] Constraints are aligned
- [ ] Milestones/phases ordering is aligned
- [ ] Acceptance criteria are aligned
- Intentional divergences:
  - (none)

## Project structure change preview (may be empty)
This section is a **non-binding, early hypothesis** to help humans confirm expected project-structure impact.

### Existing areas likely to change (may be empty)
- Modify:
  - `prisma/schema.prisma`
  - `src/backend/routes/agent-control.ts`
  - `src/backend/routes/read-api.ts`
  - `src/backend/routes/private-channel-api.ts`
  - `src/backend/services/agent-service.ts`
  - `src/backend/repos/agent-repository.ts`
  - `src/backend/repos/pg/pg-agent-repository.ts`
  - `src/backend/runtime/chat-output-sanitizer.ts`
  - `src/backend/services/agent-bio-render-service.ts`
  - `src/frontend/features/agents/components/modal/TabIntro.tsx`
  - `src/frontend/api/hooks/agent.ts`
  - `src/frontend/api/hooks/user.ts`
  - `src/shared/badges/catalog.ts`
- Delete:
  - (none)
- Move/Rename:
  - (none)

### New additions (landing points) (may be empty)
- New module(s) (preferred):
  - `src/backend/services/agent-deletion-service.ts` or equivalent lifecycle helper if existing `AgentService` grows too broad
  - `src/frontend/features/agents/components/AgentDeleteDialog.tsx` or equivalent manage-surface confirmation UI
- New interface(s)/API(s) (when relevant):
  - `DELETE /v1/agents/:agentId`
- New file(s) (optional):
  - additional route/service/component tests covering deletion and wording cleanup

## Phases
1. **Phase 1**: Language and runtime audit
   - Deliverable: a confirmed inventory of where `owner` leaks into user-facing copy and where staged-action narration enters/escapes the runtime
   - Acceptance criteria: every affected surface is classified as internal-only, admin-only, owner-facing, or public-facing
2. **Phase 2**: Wording contract and guardrails
   - Deliverable: agreed replacement vocabulary plus runtime/prompt sanitization rules
   - Acceptance criteria: user-facing agent surfaces stop foregrounding `owner`, and chat output regressions are covered by tests
3. **Phase 3**: Delete lifecycle backend
   - Deliverable: an owner-authorized delete API plus repository/service/read-model behavior for deleted agents
   - Acceptance criteria: deleted agents are no longer operable or listed in normal user flows
4. **Phase 4**: Delete UX and end-to-end fit
   - Deliverable: manage-mode delete entry, confirmation UX, cache invalidation, and smoke-tested behavior
   - Acceptance criteria: deletion is understandable, confirmable, and leaves the UI in a clean state

## Step-by-step plan (phased)
> Keep each step small, verifiable, and reversible.

### Phase 0 — Discovery
- Objective: confirm the exact wording and lifecycle surfaces before implementation.
- Deliverables:
  - Inventory of user-visible `owner` wording in agent surfaces and badges
  - Inventory of generation/sanitization path for action-stage narration
  - Inventory of `Agent` relation graph and current deletion blockers
- Verification:
  - `rg` evidence across `src/frontend/features/agents`, `src/shared`, `src/backend/runtime`, `src/backend/routes`, `prisma/schema.prisma`
  - Confirm whether deleted/archived status already exists (it does not in current `AgentStatus`)
- Rollback:
  - N/A

### Phase 1 — Language contract and output discipline
- Objective:
  - Split internal ownership vocabulary from product copy.
  - Decide where “owner” stays technical and where it must disappear.
  - Reduce theatrical/action-stage narration at the source and at the sanitizer boundary.
- Deliverables:
  - Copy policy:
    - internal contract: `owner_*` may remain
    - user-facing copy: replace with “你 / 创建者 / 管理侧 / 私聊侧 / 我的智能体” as appropriate
  - Wording updates in agent manage surfaces, badges, helper copy, and empty states
  - Prompt/runtime guardrails review for chat replies
  - Expanded sanitizer coverage for examples like `[笑]`, `（双手交叉置于胸前）`, and similar variants
- Verification:
  - Agent UI tests covering changed labels and empty states
  - Runtime sanitizer tests covering newly observed bad patterns
  - Manual review of manage/readonly modal copy
- Rollback:
  - Copy-only changes can be reverted per file
  - Sanitizer pattern tightening can be reverted without touching persistence

### Phase 2 — Delete lifecycle backend
- Objective:
  - Add a safe deletion lifecycle that matches the relational shape of the repo.
- Deliverables:
  - Final deletion semantics decision:
    - preferred: soft-delete/tombstone metadata
    - fallback: lifecycle extension with explicit deleted state
  - Owner/admin authorization and delete endpoint
  - Repository/service changes so deleted agents:
    - disappear from `/me/agents`
    - fail normal profile/chat entry
    - are excluded from active-agent loops and search projections
  - Explicit behavior for authored history and audit traces
- Verification:
  - Route tests for owner/admin allowed, non-owner denied
  - Service/repository tests for filtering and lifecycle transitions
  - Search/private-channel/read path tests for deleted-agent behavior
- Rollback:
  - Feature can be disabled by reverting endpoint + lifecycle checks
  - If schema changes are introduced, provide a down-migration or non-destructive fallback behavior

### Phase 3 — Delete UX and manage-surface integration
- Objective:
  - Expose deletion in the owner manage surface without making it easy to misfire.
- Deliverables:
  - Manage-mode delete CTA in an advanced/danger zone, not mixed with routine edits
  - Confirmation dialog with irreversible-effects copy
  - Post-delete cache invalidation, modal close/reset, and list refresh
  - Graceful empty/not-found state if a deleted agent link is reopened
- Verification:
  - Frontend tests for dialog flow and post-delete state cleanup
  - Manual smoke: create agent -> delete -> verify removal from manage list -> verify profile/chat/search behavior
- Rollback:
  - Remove CTA while keeping backend lifecycle untouched if UI fit is poor

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm exec tsc -b --pretty false`
- Automated tests:
  - `pnpm exec vitest run src/backend/runtime/__tests__/chat-output-sanitizer.test.ts`
  - `pnpm exec vitest run src/backend/services/__tests__/agent-service.test.ts`
  - `pnpm exec vitest run src/backend/routes/__tests__/e2e-agents-control-plane.test.ts`
  - `pnpm exec vitest run src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx`
  - `pnpm exec vitest run src/frontend/widgets/agent-modal/__tests__/AgentInteractionModal.test.tsx`
- Manual checks:
  - Open manage modal for owned agent and confirm no childish/action-stage text is shown in recent content blocks
  - Verify revised copy no longer uses `owner` where the user is reading product copy rather than technical diagnostics
  - Delete one owned agent and confirm:
    - it disappears from “我的智能体”
    - its manage modal no longer opens normally
    - private chat cannot continue
    - public/profile/search behavior matches the chosen deletion policy
- Acceptance criteria:
  - User-facing agent surfaces no longer lean on `owner` wording unless explicitly technical/admin-only
  - Runtime output no longer visibly leaks bracketed or parenthetical action narration in covered chat paths
  - Owners can delete an agent from the manage surface with a clear confirmation step
  - Deleted agents are hidden or blocked consistently across owner list, read profile, private chat, and active runtime loops
  - Historical data handling is explicit and tested

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| Over-cleaning removes legitimate expressive text, not just childish stage directions | medium | medium | Tighten sanitizer with concrete fixtures; prefer prompt guidance plus targeted patterns | sanitizer tests + manual sample review | revert the last pattern set |
| Replacing `owner` too broadly breaks internal/admin semantics | low | medium | Treat internal schema/auth names as out of scope; limit copy rewrites to user-facing surfaces first | grep inventory before/after | revert copy-only changes |
| Hard-delete attempt hits Prisma relational constraints across many tables | high | high | Prefer soft-delete/tombstone semantics first | failing integration tests or migration review | revert lifecycle endpoint and schema patch |
| Deleted agent still appears in a secondary surface (search, chat, scheduler) | medium | high | Add inventory-driven filtering checklist and focused regression tests | route/service smoke tests | revert endpoint or hide UI until fixed |
| Public authored history becomes inconsistent after delete | medium | high | Decide author fallback behavior before coding and test it explicitly | public profile/post manual checks | keep history untouched and disable public profile access only |

## Optional detailed documentation layout (convention)
If you maintain a detailed dev documentation bundle for the task, the repository convention is:

```
dev-docs/active/agent-language-audit-and-delete-flow/
  roadmap.md              # Macro-level planning (plan-maker)
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

The roadmap document can be used as the macro-level input for the other files. The plan-maker skill does not create or update those files.

Suggested mapping:
- The roadmap's **Goal/Non-goals/Scope** → `00-overview.md`
- The roadmap's **Phases** → `01-plan.md`
- The roadmap's **Architecture direction (high level)** → `02-architecture.md`
- Decisions/deviations during execution → `03-implementation-notes.md`
- The roadmap's **Verification** → `04-verification.md`

## To-dos
- [x] Confirm planning-mode signal handling and fallback record
- [x] Confirm input sources and trust levels
- [x] Confirm merge decisions and conflict log entries
- [x] Confirm open questions
- [x] Confirm phase ordering and DoD
- [x] Confirm verification/acceptance criteria
- [x] Confirm rollout/rollback strategy
