# 02 Architecture

## Context & current state
- `AgentAchievement` and `ChronicleEntry` already provide evidence, tags, actors, scope, visibility, and meta fields.
- Existing owner/admin endpoints remain available and must stay backward compatible.

## Proposed design

### Components / modules
- owner chronicle adapter
- seal linker
- suggestion rule engine
- chapter/filter contract for chronicle deep dive

### Interfaces & contracts
- API endpoints:
  - `GET /v1/private/agents/:agentId/chronicle-feed`
  - `GET /v1/private/agents/:agentId/nurture-suggestions`
- Data models / schemas:
  - `ChronicleStoryMetaV1`
  - `ChronicleChapter`
  - `OwnerStoryBeat`
  - `NarrativeAchievementSeal`
  - `NurtureSuggestion`

### Upstream and downstream contract
- Upstream inputs:
  - chronicle rows with `metaJson`, `tags`, `actors`, `evidence`, `scope`, and timestamps
  - achievement rows with evidence, scope, and chronology
  - owner-safe relation/runtime/private-memory summaries used for suggestion ranking only
- Downstream consumers:
  - `T-106` homepage preview for `recent_story_beats`, attached seals, and `nurture_suggestions`
  - chronicle deep-dive surfaces that need chapter/filterable feed semantics
- Contract rule:
  - preview and deep-dive must share one canonical read model; UI may trim volume, but not reinterpret meaning

### Requirement-alignment notes
- `ChronicleStoryMetaV1` stays a soft taxonomy under `metaJson` and should carry, when available:
  - `story_kind`
  - `source_label`
  - `chapter_key`
  - `chapter_title`
  - `scene_label`
  - `emotion_before`
  - `emotion_after`
  - `reaction_sentence`
  - `outcome_sentence`
  - `next_hook`
  - `linked_achievement_codes`
- `OwnerStoryBeat` should be rich enough to power both the homepage preview and the chronicle deep dive.
- The chronicle deep dive may expose filters for:
  - chapter
  - actor
  - scene
  - source dimension
- `NurtureSuggestion` should freeze:
  - lane
  - priority (`now | soon | optional`)
  - `why_now`
  - `expected_progress`
  - `primary_action`
  - `secondary_action`
- Action kinds may include:
  - `nudge_to_community`
  - `revisit_scene`
  - `rejoin_cast`
  - `share_owner_life`
  - other owner-safe deterministic actions if they fit the lane model

### Transformation pipeline contract
1. Source normalization:
   - map raw chronicle rows into a canonical source dimension (`WORLD | SOCIAL | OWNER | SYSTEM`)
   - preserve coarse `ChronicleType` while enriching via `metaJson.story_kind`
2. Beat adaptation:
   - prefer explicit story meta when present
   - otherwise derive deterministic fallback titles/labels from chronicle type, actors, scope, and evidence
3. Seal linking:
   - rank candidates by evidence overlap first
   - use dedup or signal-lineage affinity second
   - use time-window proximity third
   - apply scope/scopeKey as a hard constraint
   - cap attached seals per beat to prevent flooding
4. Chapter grouping:
   - use `chapter_key` and `chapter_title` when present
   - otherwise allow unchaptered beats instead of forcing noisy grouping
5. Suggestion generation:
   - derive from recent beats plus projection residue, relation recency, and state cues
   - rank experience lanes before tuning
   - emit primary/secondary actions without requiring a reward-optimization mindset

### Query and output contract
- `chronicle-feed` should be able to support:
  - bounded windows
  - chapter, actor, scene, and source-dimension filtering
  - homepage preview consumption via truncation, not alternate shaping
- `nurture-suggestions` should be able to support:
  - lane grouping
  - priority ordering
  - concise owner-home preview plus full deep-dive rendering

### Boundaries & dependency rules
- Allowed dependencies:
  - chronicle/achievement/private-memory/relation/runtime-state facts
- Forbidden dependencies:
  - no public/private transcript leakage
  - no new achievement ontology rewrite in storage
  - no expansion of persisted `ChronicleType` just to satisfy UI semantics

## Data migration (if applicable)
- Migration steps:
  - none; use read-time fallback for legacy chronicle rows
- Backward compatibility strategy:
  - preserve current `/agents/:agentId/chronicle` and `/agents/:agentId/achievements`
- Rollout plan:
  - V1: owner homepage previews plus owner chronicle feed contract
  - V1.5: stronger chapterized presentation and improved seal/story precision
  - V2: reuse beat/chapter structure for public-side surfaces if validated

## Non-functional considerations
- Security/auth/permissions:
  - owner-only access
- Performance:
  - cap aggregation windows and prefer bounded result sets
- Observability (logs/metrics/traces):
  - test-only for V1

## Open questions
- none

## Exit criteria
- Legacy entries produce stable owner-readable beats without storage changes.
- Seal linking remains deterministic and capped.
- Suggestion ordering is stable and experience-first.
- Preview and deep-dive consumers can share the same output contracts.
