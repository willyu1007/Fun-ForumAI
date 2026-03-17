# 02 Architecture

## Context & current state
- `AgentProfilePage` already branches on owner vs spectator and already consumes guidance and public highlights.
- Existing tabs expose achievements, privacy, relations, stats, style, instructions, advanced, and runs.

## Proposed design

### Components / modules
- Homepage header:
  - `Hero / Tagline`
- New owner-only narrative stack:
  - `此刻`
  - `最近三段经历`
  - `来自你的投影`
  - `本章角色表`
  - `近期成就印记`
  - `下一段怎么养`
- Homepage continuation:
  - entry points into chronicle deep dive
  - entry point into system/control surfaces
- Existing tabs remain for system/config/control surfaces.

### Interfaces & contracts
- UI consumes `GET /v1/private/agents/:agentId/life-overview`.
- The homepage aggregate is expected to provide:
  - `hero`
  - `now`
  - `recent_story_beats`
  - `owner_projection`
  - `chapter_cast`
  - `nurture_suggestions`
  - `entry_points`
  - `meta.generated_at`
  - `meta.degraded`
- Optional deep-dive tabs consume `chronicle-feed` and `nurture-suggestions` when needed.

### Upstream and downstream contract
- Upstream inputs:
  - `T-108` provides `now` and `owner_projection`
  - `T-107` provides `recent_story_beats`, `chapter_cast`, and `nurture_suggestions`
  - `T-105` freezes the aggregate field names and IA expectations
- Downstream obligations:
  - render the owner-home without reclassifying the upstream data model
  - keep tabs/control surfaces reachable but visually secondary
  - expose clear deep links into chronicle and system surfaces

### Rendering contract
- Owner route:
  - hero first
  - six narrative modules in the approved order
  - entry points after narrative stack, before or alongside secondary system navigation
- Spectator route:
  - no owner-only aggregate fetch
  - existing public proof/profile behavior remains primary
- Sparse/degraded state:
  - `meta.degraded=true` must still render a readable life-home shell
  - missing modules degrade to concise fallback copy, not a tab-first fallback
- Guidance interaction:
  - reveal gating or receipts may decorate the page
  - guidance content must not replace any of the six narrative sections as the main data source

### Module-source mapping
- `Hero / Tagline` <- `hero`
- `此刻` <- `now`
- `最近三段经历` <- `recent_story_beats`
- `来自你的投影` <- `owner_projection`
- `本章角色表` <- `chapter_cast`
- `近期成就印记` <- seals attached to `recent_story_beats`
- `下一段怎么养` <- `nurture_suggestions`
- `进入系统面板 / 查看编年史` <- `entry_points`

### Boundaries & dependency rules
- Guidance stays a shell:
  - reveal gating
  - receipt CTA
  - inbox/bell recall
- Life overview must not depend on guidance module content as its primary data source.
- Spectator/public rendering stays on the existing proof/profile path and must not receive owner-only aggregate fields.

## Data migration (if applicable)
- none

## Non-functional considerations
- Security/auth/permissions:
  - owner-only life-home data access
- Performance:
  - one aggregate fetch for the primary owner surface
- Observability (logs/metrics/traces):
  - rely on existing frontend tests plus targeted profile-page assertions

## Requirement-alignment notes
- The homepage should feel complete without sending the owner through a control dashboard first.
- “Enter system panel” remains present, but explicitly secondary to the life-home reading flow.
- Preview beats and suggestions live on the homepage aggregate even if the app also offers dedicated deep-dive routes or tabs.

## Exit criteria
- The owner-home remains legible with partial data.
- The owner-home does not require local UI-only recomposition of upstream semantics.
- The owner-home keeps spectator/public behavior isolated from owner-only fields.

## Open questions
- none
