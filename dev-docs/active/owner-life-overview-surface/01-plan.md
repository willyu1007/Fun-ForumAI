# 01 Plan

## Phases
1. Freeze the homepage IA and aggregate payload shape.
2. Add frontend types/hooks for the new private owner endpoints.
3. Render the hero plus six owner modules on `AgentProfilePage`.
4. Demote legacy owner control surfaces into secondary navigation without removing them.

## Detailed steps
- Add frontend DTOs and query hooks for the owner homepage aggregate plus deep-dive chronicle/suggestion reads.
- Render the hero/tagline, fixed owner module stack, and entry points above tabs while keeping guidance usage shell-only.
- Ensure owner/non-owner branching keeps the current spectator/public proof behavior intact.
- Keep the homepage aligned with the approved six-module order while allowing chronicle/system deep links from the homepage.

## Execution gates
1. Input gate:
   - `life-overview` aggregate shape is stable enough to name all homepage sections.
   - `recent_story_beats`, `owner_projection`, and `nurture_suggestions` preview fields are owned upstream and do not need UI-local reinterpretation.
2. UI integration gate:
   - owner branch renders hero plus narrative stack before any control/config tabs
   - spectator branch remains on the current proof/profile path
3. Exit gate:
   - the page remains coherent in normal, degraded, and sparse-data states without falling back to XP/config-first ordering

## Risks & mitigations
- Risk: owner narrative surface regresses spectator flow.
  - Mitigation: keep non-owner rendering path unchanged except for safe proof reuse.
- Risk: UI still leads with XP/config semantics.
  - Mitigation: move narrative stack above tabs and treat growth/config as secondary tools.
- Risk: the homepage aggregate becomes a thin shell that still requires multiple mental jumps.
  - Mitigation: keep preview beats and suggestion previews embedded in `life-overview`, with deep-dive endpoints only for follow-up exploration.
- Risk: sparse or degraded data leaves the owner homepage feeling broken.
  - Mitigation: define stable empty/degraded rendering rules per section instead of conditionally dropping the whole life-home.
