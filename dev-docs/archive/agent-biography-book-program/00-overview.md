# 00 Overview — agent-biography-book-program (T-202)

## Status
- State: done
- Depends on: `T-107 chronicle-story-beat-seal-and-suggestions`, `T-902 chronicle-chapter-summary-alignment`, `T-925 agent-social-bio-domain-and-refresh-pipeline`
- Current status: the program bundle completed its orchestration role. `T-203` through `T-205` have landed end to end, and the resulting chain now reads as a single biography-book system rather than three disconnected implementation threads.
- Current conclusion: the final delivery chain is closed: `T-203` owns the shared reading surface, `T-204` owns the persistent chapter/compile domain, and `T-205`/`T-206` own writer, audit, and dedicated biography routing. No open program-level contract gaps remain inside the scoped rollout.

## Goal
Create the implementation program for upgrading “我的智能体弹窗 > 编年史” from a growth-information panel into an agent biography book experience with:

- a single shared reading surface for owner and readonly viewers
- a book-shaped read model for the history tab
- a staged path from existing story-beat read models to chapter persistence and writer generation

## Non-goals
- Do not implement product code in this bundle.
- Do not redesign mobile App surfaces in this program.
- Do not introduce an owner-only terminal chronicle view.
- Do not move nurture actions back into the final biography reading surface.

## Context
Current repo state already provides two useful foundations:

- owner chronicle read models (`chapter`, `story beats`, `chapter cast`) from the owner-life-overview line
- a governed hidden-writer pattern from agent social bio (`worldview`, prompt registry, render log, audit-minded refresh pipeline)

What is still missing is the final biography system itself:

- a single `AgentBiographyBookViewModel`
- persistent chapter/skeleton/revision/memory contracts
- a history-tab UI that reads like a book instead of a dashboard

## Acceptance criteria
- [x] The program is split into a master bundle plus three decision-complete implementation bundles.
- [x] Each implementation bundle has a clear contract, scope boundary, acceptance criteria, and dependency order.
- [x] The implementation path stays mapped to `M-000 > F-020 > R-022` and records dependencies on `R-032`, `R-070`, and `R-071` in bundle text rather than opening a new requirement.
- [x] The implementation sequence is explicit enough that engineering can begin without re-running product discovery.
- [x] Coverage against the requirement document’s sections `6` through `15` and appendix contracts is explicitly assigned, including `BiographyMaterial`, `BiographyMaterialDigest`, `AgentBiographyChapterSkeletonV1`, `BiographyChapterDigest`, `BookMemory`, `ToneProfile`, later note handling, and UI/body contracts.
- [x] Every bundle defines an explicit review gate that must be closed before the next bundle advances.
