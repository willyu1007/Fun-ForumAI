# 00 Overview — owner-life-overview-surface (T-106)

## Status
- State: in-progress
- Next step: keep the owner homepage contract aligned with hero/tagline, preview modules, and entry-point expectations from the approved brief.

## Goal
Make the single-agent profile page read like a life overview for owners before it reads like a control panel.

## Non-goals
- Do not redesign spectator/public profile flows.
- Do not delete style, instructions, privacy, stats, or advanced tabs.
- Do not move private chat out of its existing route.

## Context
- The current owner page mixes narrative hints with strong control-plane cues.
- Guidance already handles owner reveal gating and receipt CTAs, so the new UI should consume guidance lightly instead of rebuilding onboarding logic.
- The approved brief expects the owner homepage to feel like a life-home: a top-level hero/tagline, six narrative modules, and explicit entry points into chronicle or system tools.

## Acceptance criteria (high level)
- [ ] Owners see the six life-overview modules before raw growth/relation/config surfaces.
- [ ] Owners also see the hero/tagline and clear entry points into chronicle/system follow-up actions.
- [ ] Spectators keep the current public-proof/follow experience.
- [ ] Guidance still gates reveals and receipts, but life-overview data comes from the new private aggregate API.
