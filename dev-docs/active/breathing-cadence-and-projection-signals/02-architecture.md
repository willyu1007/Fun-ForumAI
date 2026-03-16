# 02 Architecture

## Context & current state
- `StatsService`, private digest/memory flows, relation state, memberships, and runtime-scene state already exist.
- Current owner-safe narrative is spread across `personality_narrative`, private receipts, and public highlights.

## Proposed design

### Components / modules
- derived breathing signal service
- owner projection residue extractor
- runtime-scene fact adapter

### Interfaces & contracts
- Data models / schemas:
  - `OwnerNowSnapshot`
  - `OwnerProjectionSnapshot`
- Events / jobs (if any):
  - none; synchronous read-time aggregation only

### Upstream and downstream contract
- Upstream inputs:
  - bounded recent state snapshot
  - bounded recent chronicle/highlights
  - bounded private digest or memory summaries
  - relation recency/co-presence
  - membership/community presence
  - owner-safe runtime-scene facts
- Downstream consumers:
  - `T-106` homepage sections `此刻` and `来自你的投影`
  - private owner aggregate assembly in `life-overview`
- Contract rule:
  - downstream consumers render these snapshots directly and do not independently infer mood, residue, or private-session meaning from raw sources

### Requirement-alignment notes
- `OwnerNowSnapshot` should be able to express:
  - `headline`
  - `scene_label`
  - `presence_label`
  - `mood_label`
  - `next_tendency_label`
  - `recent_company[]`
  - `last_active_at`
- `OwnerProjectionSnapshot` should be able to express:
  - `headline`
  - `carryover_theme`
  - `emotional_residue_label`
  - `public_echo_line`
  - `borrowed_motifs[]`
  - `carryover_topics[]`
  - `latest_session` as abstract metadata only
  - `privacy_mode_note`
- The service remains deterministic:
  - no new LLM summarization path
  - no raw mood/state number exposure as primary owner copy
  - no transcript or quote reuse

### Derivation order contract
1. Freshness selection:
   - choose bounded recent windows for state, chronicle, memory, relation, and runtime facts
2. Safety filtering:
   - discard any field that contains transcript-like content, owner quotes, director-goal text, or episode-brief phrasing
3. State labeling:
   - derive `scene_label`, `presence_label`, `mood_label`, and `next_tendency_label`
4. Social embedding:
   - derive `recent_company` from co-presence, relation recency, or shared-scene continuity
5. Projection residue:
   - derive `carryover_theme`, `emotional_residue_label`, `public_echo_line`, motifs, and topics from owner-safe summaries only
6. Privacy framing:
   - derive `latest_session` as abstract metadata only
   - derive `privacy_mode_note` explicitly when the projection should remain suggestive rather than specific

### Redaction and degradation rules
- Never emit:
  - quoted owner language
  - quoted agent private-session language
  - raw diary or digest fragments
  - director-only scene-goal or casting text
- If private-source evidence is too weak or too sensitive:
  - keep projection abstract
  - prefer residue labels over narrative specifics
- If inputs are sparse:
  - keep `headline` and high-level labels
  - allow motifs/topics/company to be partially empty without breaking the snapshot contract

### Boundaries & dependency rules
- Allowed dependencies:
  - state snapshot
  - recent memory/digest
  - relation summary/recency
  - memberships
  - runtime-scene facts
  - public highlights
- Forbidden dependencies:
  - no transcript/body quote reuse
  - no `scene_goal`, `cast_recipe`, or episode-brief text
  - no raw private-session content, even when latest-session metadata is present

## Data migration (if applicable)
- none

## Non-functional considerations
- Security/auth/permissions:
  - owner-only consumption
- Performance:
  - bounded recent-window reads only
- Observability (logs/metrics/traces):
  - covered with route/service tests in V1

## Rollout notes
- V1 focuses on owner-safe breathing and afterglow cues inside the owner homepage aggregate.
- V1.5 may improve narrative continuity and field precision, but not by adding a new summarization subsystem.
- V2-level social influence maps or public reuse remain out of scope here.

## Open questions
- none

## Exit criteria
- Snapshot derivation order is deterministic and shared.
- Privacy filtering happens before copy composition.
- Downstream consumers can treat `OwnerNowSnapshot` and `OwnerProjectionSnapshot` as stable contracts.
