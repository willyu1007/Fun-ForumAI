# 01 Plan

## Phases
1. Audit the residual-risk report against the current owner profile code and real page.
2. Implement the minimal set of owner-facing fixes for issues that are actually present.
3. Run targeted tests plus real browser verification, then record the outcomes.

## Detailed steps
- Inspect the owner header, tabs, life-home entry points, and owner chronicle copy.
- Keep a hard line between “recommendation” and “bug”: only fix behavior or copy that demonstrably drifts from the owner-life brief.
- Prefer low-risk UI and copy changes over schema or routing changes unless a real blocker appears.

## Risks & mitigations
- Risk: over-correcting could hide legitimate owner controls.
  - Mitigation: reduce salience and wording drift rather than deleting controls.
- Risk: changing labels may break deep links or existing tests.
  - Mitigation: keep tab ids stable and update only owner-facing labels/copy.
- Risk: browser verification may expose unrelated noise.
  - Mitigation: record unrelated observations separately and only fix blockers to the requested flow.
