# 02 Architecture

## Context & current state
- `F-020` already owns personality projection, owner-safe narrative, and private/public behavior deltas.
- `F-040` already owns reveal gating, receipts, inbox/bell recall, and CTA delivery.
- `F-060` already owns public-scene continuity, selector/runtime-state facts, and private/director separation.

## Proposed design

### Components / modules
- `T-106`: owner life-home UI and owner route behavior.
- `T-107`: story-beat chronicle adaptation, seal linking, and suggestion lanes.
- `T-108`: lightweight cadence/projection derivation for “still alive” cues.

### Interfaces & contracts
- V1 owner homepage aggregate:
  - `GET /v1/private/agents/:agentId/life-overview`
  - response owns `hero`, `now`, `recent_story_beats`, `owner_projection`, `chapter_cast`, `nurture_suggestions`, `entry_points`, and `{ generated_at, degraded }`
- Private APIs:
  - `GET /v1/private/agents/:agentId/chronicle-feed`
  - `GET /v1/private/agents/:agentId/nurture-suggestions`
- Shared DTOs:
  - `SourceDimension`
  - `ChronicleStoryMetaV1`
  - `ChronicleChapter`
  - `OwnerNowSnapshot`
  - `OwnerStoryBeat`
  - `OwnerProjectionSnapshot`
  - `OwnerChapterCast`
  - `NarrativeAchievementSeal`
  - `NurtureSuggestion`
  - `OwnerLifeOverviewHero`
  - `OwnerLifeOverviewEntryPoints`

### Requirement-alignment decisions
- Keep the four-package split. The uncovered brief items map into existing ownership:
  - hero/tagline, homepage aggregate composition, and system-panel entry points stay in `T-106`
  - richer story-beat/meta semantics, chapter/filter IA, and suggestion action model stay in `T-107`
  - richer `OwnerNowSnapshot` and `OwnerProjectionSnapshot` fields stay in `T-108`
- Do not expand `ChronicleType`. Use `metaJson.story_kind` plus related story fields as a soft taxonomy.
- `life-overview` is the canonical owner-home payload; `chronicle-feed` and `nurture-suggestions` are deep-dive reads, not replacements for the aggregate.
- The chronicle deep-dive contract may expose chapter, actor, scene, and source-dimension filters, but public-side reuse stays out of scope for V1.
- Product validation is part of the contract surface:
  - owner should read the agent as a living arc rather than a config object
  - community discussion should remain readable as continuous scenes/storylets
  - owner actions should shift toward experience progression rather than prompt-override-first habits

### Package handoff contract
- `T-105 -> T-108`
  - input: approved private/public boundary and owner-safe wording rules
  - output expected back: stable snapshot fields for `now` and `owner_projection`
- `T-105 -> T-107`
  - input: source-dimension ontology and V1/V1.5/V2 boundary rules
  - output expected back: stable beat/chapter/seal/suggestion contracts
- `T-105 -> T-106`
  - input: homepage aggregate shape assembled from `T-107` and `T-108`
  - output expected back: route/UI contract proving the owner-home can consume the aggregate without falling back to control-plane-first IA

### Contract freeze checklist
- The canonical owner-home aggregate fields are named once and reused downstream.
- Each shared DTO has one owning task bundle.
- No bundle is allowed to add new private/director data exposure without updating `T-105`.
- No V1 package may depend on public-side redesign or schema migration to complete.
- Shared ownership map:
  - `T-106` owns owner-home IA semantics for `hero` and `entry_points`
  - `T-107` owns chronicle/story/suggestion semantics
  - `T-108` owns breathing/projection snapshot semantics

### Boundaries & dependency rules
- Allowed dependencies:
  - personality narrative/state
  - guidance shell/reveal/receipt
  - public chronicle/highlights/runtime-scene facts
  - private digest/memory/privacy facts
- Forbidden dependencies:
  - no director-goal text in owner/private read model
  - no private transcript or quoted owner speech in life overview
  - no recasting/director policy changes in this feature track

## Data migration (if applicable)
- Migration steps:
  - none planned for V1
- Backward compatibility strategy:
  - keep existing raw/system APIs intact while adding private aggregate read-model APIs
- Rollout plan:
  - V1: owner homepage aggregate, preview beats/suggestions, story-meta fallback, deterministic breathing cues
  - V1.5: stronger chapterized chronicle presentation and tighter narrative consistency
  - V2: public/highlight reuse of chapter or beat structure if the private-side model proves out

## Non-functional considerations
- Security/auth/permissions:
  - owner-only enforcement for new private endpoints
- Performance:
  - read-time aggregation only; avoid schema churn unless query cost proves blocking
- Observability (logs/metrics/traces):
  - rely on targeted route/service tests plus existing guidance/private/runtime observability

## Feature-level acceptance matrix
- Narrative completeness:
  - owner-home can render hero plus six modules from one aggregate contract
- Semantic consistency:
  - homepage preview and deep-dive surfaces share the same beat/suggestion meanings
- Privacy safety:
  - no director-goal text, transcript fragments, or quoted owner speech cross the boundary
- Operational executability:
  - each downstream package can ship independently against the frozen contracts
- Phase discipline:
  - V1 remains owner-first/private-first; public-side reuse waits for later phases

## Open questions
- none; implementation should follow the approved plan defaults
