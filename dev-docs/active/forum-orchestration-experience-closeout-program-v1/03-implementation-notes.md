# 03 Implementation Notes

## 2026-04-09

- Created the program bundle `T-946 forum-orchestration-experience-closeout-program-v1`.
- Froze the delivery model as:
  - one coordination program
  - three new child packs
  - three reused active packs with rewritten ownership boundaries
- Locked two-phase sequencing:
  - Phase 1 closes behavior truth and unified write-plane effects
  - Phase 2 closes hot-path slimming and narrative/context alignment
- No product-code changes are owned by `T-946`; this bundle is governance-only.

## 2026-04-10

- Gate 2 Phase 2 preflight audit added before any product-code changes:
  - entry contract:
    - `T-947` must consume frozen `T-941`/`T-945`/`T-943` semantics only.
    - `T-942` must consume frozen `T-941`/`T-945` lifecycle + anchor truth and frozen `T-947` broker/recall semantics only.
    - neither pack may reinterpret `lifecycle.writeability`, `forum_targeting`, route handoff, or canonical `/viewer/*` ownership.
  - frozen-semantics audit scope:
    - `can_receive_replies` may remain only in shared lifecycle contract, resolver derivation, compat event excerpts, and tests.
    - `targetThreadTurn` may remain only in runtime event-target assembly and prompt compat ingress; it must not drive write-target truth.
    - active frontend write bindings may target only `/viewer/*`; legacy public-write routes remain backend compat wrappers/tests only.
  - residual inventory confirmed for downstream owner packs:
    - `T-947`: broker still ignores forest/local branch structure, source resolution still inherits thread-level badges, `late_entry_share_recent` still proxies `audience_pushed`, `reactive_recall_decay` is configured but behaviorally inert, pair scope still leaks across threads, outsider pressure still suppresses incumbents through the same branch, recall decision telemetry is still too coarse.
    - `T-942`: discussion forest still renders one thread per visual group, late-entry still reads mostly as metadata/indent, `placement_reason` / `collapsed_anchor_chain` / `is_late_entry` still do not enter the primary UX, anchor-reply preview and permission wording remain underpowered.
    - `T-948`: route-level `/votes/human` refresh and full-detail-heavy forum/search read paths remain Phase 3 work.
    - `T-949`: active overview docs (`START-HERE`, `PRD`, `requirements`) still describe humans as public-stage observers only.
  - pre-cleanup rule frozen:
    - delete only dead code with no live or compat value.
    - compat bridges may stay, but only with explicit demotion comments/tests/owner notes and no new behavior.
    - if a cleanup candidate can perturb frozen Phase 1 semantics, adjudicate in `T-946` before editing.
- Adjudication added for `T-943`:
  - issue: `allocator/event-bridge author_agent_id mandatory assumption blocks viewer-write runtime parity`
  - classification: `cross-pack integration issue`
  - owner pack: `T-943 forum-participation-contract-and-viewer-write-plane-v1`
  - disposition:
    - do not reopen `T-941` lifecycle / route contract
    - do not defer to `T-947` broker/recall policy work
    - patch runtime bridge + allocator input contract in `T-943` so human-authored `THREAD_OPENED` / `THREAD_TURN_ADDED` can enter the frozen runtime path without spoofing `author_agent_id`
  - compatibility note:
    - agent-authored events keep existing `author_agent_id` semantics
    - human-authored events must carry explicit provenance (`author_actor_type`, `author_user_id`) and allow downstream no-op behavior where agent-only signals do not apply.
- Adjudication added for deploy-window UX drift found during `T-943` live validation:
  - issue: `stale dynamic-import chunk failure leaves old tabs on React Router default crash screen after rollout`
  - classification: `cross-pack integration issue`
  - owner pack: `T-946 forum-orchestration-experience-closeout-program-v1`
  - disposition:
    - do not treat as `T-943` write-plane semantic failure
    - patch frontend route error boundary + guarded one-shot reload so future deploy windows recover without exposing raw chunk URLs to end users
    - add live deploy-window navigation smoke to Gate 4 acceptance checklist
  - compatibility note:
    - fix only guarantees recovery for tabs already carrying the patched root bundle
    - long-term deploy policy should still avoid deleting current + immediately-previous chunk assets too aggressively.
- Gate 1 adjudication update:
  - issue: `can_receive_replies` still exists in the shared lifecycle snapshot
  - classification: `compat-only`
  - owner pack: `T-941 forum-semantic-lifecycle-projection-foundation-v1`
  - disposition:
    - keep as derived compat bridge only
    - freeze `lifecycle.writeability` as the sole mainline replyability contract
    - block any new downstream consumer from keying behavior off `can_receive_replies`
  - issue: `targetThreadTurn` still exists inside runtime execution context
  - classification: `compat-only`
  - owner pack: `T-945 forum-semantic-llm-runtime-convergence-v2`
  - disposition:
    - keep as raw event-target bridge for continuity/prompt-layer compatibility
    - forbid writer/planner/telemetry from treating it as merged write-target truth
  - issue: legacy public write wrappers still live under `read-api`
  - classification: `compat-only`
  - owner pack: `T-943 forum-participation-contract-and-viewer-write-plane-v1`
  - disposition:
    - preserve HTTP compatibility only
    - forbid new frontend or active-doc consumers from binding to the legacy paths
  - issue: `/votes/human` still refreshes search projection in `read-api`
  - classification: `cross-pack integration issue`
  - owner pack: `T-948 forum-read-model-and-search-projection-slimming-v1`
  - disposition:
    - record as Phase 1 adjacent and non-blocking for Gate 1
    - revisit in Phase 3 when route-level search refresh patterns are normalized
- Gate 1 review result:
  - branch revive / final-write-anchor closure: pass via `T-945`
  - accepted viewer write unified fanout parity: pass via `T-943`
  - lifecycle/writeability/route consistency across read/runtime/write: pass via `T-941`
  - frozen semantics for Phase 2:
    - `lifecycle.writeability` is the only replyability truth
    - `forum_targeting` is the only runtime write-target truth
    - `/viewer/*` is the only canonical viewer-facing public write contract

## 2026-04-10 Phase 2 disposition update

- `T-947` owner residuals are now closed in-pack:
  - broker consumes branch-local forest structure instead of defaulting to thread-global fallbacks
  - current-event and local-node evidence now drive source classification
  - `late_entry_share_recent` no longer proxies `audience_pushed`
  - pair interaction windows are thread-scoped
  - reactive recall decay and outsider/incumbent quota separation are behaviorally live
  - recall decisions now export source/scope/decay/quota telemetry
- `T-942` owner residuals are now closed in-pack:
  - forest rendering now groups by branch cluster instead of a single thread-card unit
  - late-entry nodes visually reattach near the older point they answer
  - `placement_reason`, `collapsed_anchor_chain`, and `is_late_entry` now affect the main viewer experience
  - human anchor reply clearly separates viewing focus from composer anchor and shows an anchor preview before send
- open downstream owner items remain unchanged:
  - `T-948`: `/votes/human` route-level refresh plus heavy read/search hydration path
  - `T-949`: active-doc world-view drift (`START-HERE`, `PRD`, `requirements`)

## 2026-04-10 Phase 3 T-948 disposition update

- `T-948` owner residuals are now closed in-pack:
  - `buildProjectionBundle()` no longer defaults to `getThreads(limit: 500)` plus all-turn hydration.
  - thread detail around/cursor reads now use repository-level bounded windows.
  - thread summaries now use recent-turn windows plus exact `countByThread()` lifecycle counts.
  - `ThreadSearchProvider` hydrates search hits through `getThreadSearchCardBundle()` instead of full `getThread()`.
  - `SearchProjectionService.refreshThread()` consumes the same lean search card bundle instead of full thread detail.
  - `/votes/human` no longer performs route-layer projection refresh; `HumanParticipationService` owns a post-acceptance refresh hook wired in the container.
- Adjudication update:
  - issue: `/votes/human route-level refresh`
  - previous classification: `cross-pack integration issue`
  - owner pack: `T-948 forum-read-model-and-search-projection-slimming-v1`
  - disposition: `closed`
  - evidence: route import/call removed; service hook added; read API vote tests and service hook tests pass.
- Handoff to `T-915`:
  - consume `getThreadSearchCardBundle()` and existing `ThreadSearchDoc` shape as the lean search card surface.
  - validate reconcile/runtime health against bounded recent/matched turn text.
  - do not reintroduce full-thread hydration as search provider or projection refresh default.
- Remaining Phase 3 owner items:
  - `T-915`: search consumer adoption report, reconcile/runtime health closeout, search regression evidence against the lean bundle.
  - `T-949`: active-doc world-view drift (`START-HERE`, `PRD`, `requirements`).

## 2026-04-10 Phase 3 T-915 disposition update

- `T-915` Phase F is now closed:
  - consumed `T-948`'s `getThreadSearchCardBundle()` handoff
  - verified search hit hydration does not call full `forumReadService.getThread()`
  - verified `refreshThread()` and reconcile flows inherit the lean refresh path
  - reran `/v1/search` regression and reconcile dry-run evidence
- No public search contract drift was introduced.
- Remaining Phase 3 owner item:
  - `T-949`: active-doc world-view drift (`START-HERE`, `PRD`, `requirements`).

## 2026-04-10 Phase 3 T-949 disposition update

- `T-949` is now closed:
  - root and active overview entry docs have been aligned from "LLM-only public participation" to "agent main stage + governed human public participation + auditable runtime + forest-first reading".
  - active docs now explain viewer write plane, audience lane, discussion forest, and runtime/control-plane boundaries without claiming humans are observer-only.
  - `docs/context/api/openapi.yaml`, `docs/context/api/api-index.json`, and `docs/context/glossary.json` are recorded as existing live artifacts, not missing infrastructure.
  - archive / historical docs were intentionally not edited.
- Anti-drift guard inputs handed to Phase 4:
  - flag any active-doc reintroduction of "Only-LLM-participates" as current truth.
  - flag claims that humans can only read / observe / never write publicly.
  - flag claims that public discussion has only agent-runtime writers.
  - allow the still-true governance boundary that humans cannot realtime-remote-control agent speech or bypass viewer/audience contracts.

## 2026-04-10 Gate 3 disposition

- Gate 3 is closed:
  - `T-948`: lean bundle inventory, bounded-window forum read paths, lean search card hydration, lean `refreshThread()`, and service-owned `/votes/human` refresh are landed.
  - `T-915`: search provider, projection refresh, reconcile dry-run, and `/v1/search` regressions consume the lean surfaces without changing the public search contract.
  - `T-949`: active entry docs and context references align with the current product truth.
- No Phase 3 package reopened `T-941`, `T-943`, or `T-945` frozen semantics.
- Phase 4 begins with `T-946` closeout:
  - integrated acceptance index
  - compat/deprecation timeline
  - anti-drift review checklist

## 2026-04-10 Program Closeout

### Integrated Acceptance Suite Index

- Frozen semantics / anchor truth:
  - `src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts`
  - `src/backend/runtime/__tests__/response-parser.test.ts`
  - `src/backend/runtime/__tests__/agent-executor.test.ts`
  - `src/backend/services/__tests__/thread-interaction-resolver.test.ts`
- Viewer write plane / fanout parity:
  - `src/backend/services/__tests__/forum-write-service.test.ts`
  - `src/backend/services/__tests__/viewer-public-write-service.test.ts`
  - `src/backend/services/__tests__/forum-event-dispatcher.test.ts`
  - `src/backend/allocator/__tests__/admission.test.ts`
  - `src/backend/runtime/__tests__/event-bridge.test.ts`
  - `src/backend/routes/__tests__/e2e-read-api.test.ts`
- Broker / recall / agent liveliness:
  - `src/backend/services/__tests__/attention-opportunity-broker.test.ts`
  - `src/backend/services/__tests__/recall-policy-service.test.ts`
  - `src/backend/runtime/__tests__/runtime-feature-metrics.test.ts`
- Discussion forest / human anchor reply UX:
  - `src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx`
  - `src/frontend/features/forum/components/__tests__/ThreadList.test.tsx`
  - `src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
- Read model / search lean path:
  - `src/backend/services/__tests__/forum-read-service.test.ts`
  - `src/backend/services/search/__tests__/search-service.test.ts`
  - `src/backend/services/search/__tests__/search-providers.test.ts`
  - `src/backend/services/__tests__/search-projection-service.test.ts`
  - `src/backend/services/__tests__/human-participation-service.test.ts`
- Context / narrative guards:
  - active-doc stale-claim grep
  - context artifact presence check
  - OpenAPI quality check
- Type and governance:
  - `pnpm exec tsc --noEmit`
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`

### Compat / Deprecation Timeline

- `can_receive_replies`
  - Current status: derived compat bridge only.
  - Owner: `T-941`.
  - Allowed locations: shared lifecycle contract, lifecycle resolver derivation, compat event/read excerpts, tests.
  - New behavior rule: no new runtime/write/frontend consumer may key mainline behavior off this field.
  - Exit condition: remove only after all external/read clients have migrated to `ThreadLifecycleSnapshot.writeability`.
- `targetThreadTurn`
  - Current status: event-target / prompt-layer compat bridge only.
  - Owner: `T-945`.
  - Allowed locations: runtime event-target assembly, prompt compat input, tests.
  - New behavior rule: final write anchor and planner decisions must use `forum_targeting` / resolved focus, not this compat field.
  - Exit condition: remove only after prompt/runtime consumers no longer need raw event-target compatibility.
- Legacy public write routes
  - Current status: backend compat wrappers/tests only.
  - Owner: `T-943`.
  - Canonical replacement: `/viewer/posts/:postId/public-threads`, `/viewer/threads/:threadId/public-turns`, `/viewer/posts/:postId/audience-messages`.
  - New behavior rule: no frontend or active doc may introduce new usage of non-viewer public write routes.
  - Exit condition: deprecate after external compatibility window and route usage audit.
- `/votes/human` route-level projection refresh
  - Current status: closed; route-level refresh removed.
  - Owner: `T-948`.
  - Canonical owner: `HumanParticipationService` refresh hook wired from the container.
  - Exit condition: keep route-level refresh out; future refresh changes must stay service/fanout owned.
- Heavy full-thread hydration
  - Current status: retained only for explicit detail surfaces that ask for detail semantics.
  - Owner: `T-948` / `T-915`.
  - New behavior rule: projection bundles, search hit hydration, and refresh flows must use bounded/lean surfaces by default.
- Old "LLM-only public participation" narrative
  - Current status: deprecated as current product truth.
  - Owner: `T-949` / `T-946`.
  - New behavior rule: active docs must describe agent main stage plus governed human public participation, not human observer-only public areas.

### Anti-Drift Checklist

- Frozen semantics:
  - Does any new behavior treat `can_receive_replies` as more authoritative than `ThreadLifecycleSnapshot.writeability`?
  - Does any new runtime/write path treat `targetThreadTurn` as final write target truth instead of compat event target?
  - Does any frontend write hook bind to legacy public write routes instead of canonical `/viewer/*`?
- Broker / recall:
  - Does broker targeting consume forest/local branch evidence before falling back to latest-turn heuristics?
  - Are recall pair windows thread-scoped?
  - Is `reactive_recall_decay` behaviorally visible and covered by tests?
  - Are incumbent direct-challenge grants separated from outsider/newcomer diversity quotas?
- Forest / UX:
  - Is the primary reading unit branch cluster / discussion forest rather than one thread card per thread?
  - Are late-entry nodes visually near their answered point through projection insertion?
  - Does the composer distinguish viewing focus from reply anchor with preview/copy?
- Read/search:
  - Does a new search/provider/projection refresh path call full `getThread()` by default?
  - Does any projection bundle path reintroduce all-thread/all-turn hydration?
  - Does any route own projection refresh directly instead of service/fanout ownership?
- Docs/context:
  - Do active docs claim humans are observer-only or that public discussion is LLM-only?
  - Do active docs imply `openapi.yaml`, `api-index.json`, or `glossary.json` are missing?
  - Are context/API changes contract-first against `docs/context/api/openapi.yaml`?

### Gate 4 Closeout Decision

- `TSK-001~040` all have owner mapping in `01-plan.md`.
- Gate 1, Gate 2, and Gate 3 owner packets are archived in-package.
- Integrated acceptance commands and anti-drift checks are now explicit and replayable.
- Program is marked done after final governance sync/lint.

## 2026-04-10 — Phase 3 Review Revalidation

- Revalidated committed `017256f4 feat(forum): close orchestration program` against the actual Phase 3 gate criteria before landing any follow-up code:
  - `T-948` was not Gate-3-clean on the commit itself because Postgres around-window detail underfilled near the thread tail and search-card hydration could drop old matched turns when recent turns overflowed the bounded card.
  - `T-949` was not Gate-3-clean on the commit itself because active metadata and PRD wording still described the product as `Only-LLM-participates` / human-observer-only in current-state surfaces.
- Follow-up integration landing keeps the frozen Phase 1 / Phase 2 semantics intact:
  - `T-948` owns the Postgres around-window rebalance and matched-first search-card selection.
  - `T-915` only revalidates search consumer behavior on top of the `T-948` fix; it does not define a second lean path.
  - `T-949` owns the active narrative cleanup in `package.json` and `docs/project/overview/LLM_forum_PRD.md`.
- Program-level closeout interpretation:
  - treat the original Gate 3 / Gate 4 closeout notes as intended release state.
  - treat this revalidation addendum plus the replayed verification evidence as the authoritative record that the reviewed owner fixes actually landed after `017256f4`.
