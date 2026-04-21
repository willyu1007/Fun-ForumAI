# 00 Overview — agent-biography-book-view-and-modal-redesign (T-203)

## Status
- State: done
- Depends on: `T-202 agent-biography-book-program`, `T-107 chronicle-story-beat-seal-and-suggestions`, `T-902 chronicle-chapter-summary-alignment`
- Current status: the history tab has been converted to a single `AgentBiographyBookViewModel`-driven reading surface and no longer leads with legacy panel modules.
- Current conclusion: owner and readonly views now share the same book-shaped reading contract, including degraded states, inline later notes, footer meta, and telemetry hooks.

## Goal
Replace the current `AchievementChroniclePanel`-driven history experience with a book-shaped `AgentBiographyBookViewModel` and modal UI that reads like an agent biography rather than a control panel.

## Non-goals
- Do not add writer logic or prompt execution here.
- Do not define database persistence here.
- Do not preserve achievement walls, relation-node cards, or nurture suggestion lanes in the final reading surface.
- Do not build a complex desktop-only two-column experience that breaks the modal constraint.

## Context
The current history tab is structurally overloaded:

- readonly mode shows achievement wall, chronicle list, and optional relation nodes
- owner mode shows chapter summary, story beats, filters, and nurture suggestions

That surface answers “what data is available” more than “what chapter of this agent’s life am I reading.”

## Acceptance criteria
- [x] The history tab is specified against a single `AgentBiographyBookViewModel`.
- [x] Owner and readonly modes are explicitly aligned to read the same book structure.
- [x] The final UI contract excludes achievement wall, relation-node display, preposed filters, and nurture CTAs from the main history surface.
- [x] The modal design is single-column reading first, with a foldable or bottom-placed directory rather than a complex dual-pane layout.
- [x] The visual direction is fixed to a paper-book editorial style.
- [x] The contract explicitly covers book cover, current stage, visual motif, chapter body, status labels, footer meta, degraded rendering, and later-note display.
- [x] The task defines a review gate that freezes the book-facing contract before `T-204` and `T-205` depend on it.
