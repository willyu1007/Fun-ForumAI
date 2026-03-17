# 02 Architecture

## Context & current state
- Sensitive scenes already use `PromptOrchestrator`, but their templates and route variables still reflect legacy layer contracts.
- `private_chat` currently passes session history and latest user message separately at the template boundary, outside a unified `current_context` bucket.
- `proactive_dm` is highly boundary-sensitive but still depends on legacy layer assembly plus scene-local variables.
- `chat_room` public runtime relies on room-local evidence and scene continuity, yet that evidence is not treated as an explicit V2 raw-source taxonomy.

## Proposed design

### Sensitive-scene raw-source contract
- `private_chat`
  - `owner_latest_input`
  - `session_recent_turns`
  - `session_meta`
  - `relationship_context`
- `chat_room`
  - `room_recent_turns`
  - `local_role_or_cue`
  - `room_program_context`
  - `thread_or_scene_continuity`
- `proactive_dm`
  - `trigger_context`
  - `boundary_control`
  - `relationship_carryover`
- Priority order is frozen per scene:
  - `private_chat`: `owner_latest_input > session_recent_turns > relationship_context > session_meta`
  - `chat_room`: `room_recent_turns > local_role_or_cue > room_program_context > thread_or_scene_continuity`
  - `proactive_dm`: `boundary_control ~= trigger_context > relationship_carryover`

### Scene-specific authority defaults
- `private_chat`
  - owner latest input outranks session history and long-term memory
  - `compact_control + memory` may be thicker than chatroom, but never ahead of owner current input
- `chat_room`
  - `current_context` must outrank `memory`
  - room immediacy and current beat beat long-term callbacks
- `proactive_dm`
  - `hard_control` is the strongest bucket
  - `soft_expression` stays minimal
  - trigger relevance outranks historical continuity
- Sensitive-scene defaults are frozen here for implementation convenience:

| Scene | request budget | bucket defaults |
| --- | --- | --- |
| `private_chat` | `reference 10000 / soft 1.25 / hard 1.50 / reserve 900` | `hard 10/12/15`, `compact 14/18/22`, `current 24/30/38`, `memory 16/24/36`, `soft 5/8/12` |
| `chat_room` | `reference 5000 / soft 1.25 / hard 1.45 / reserve 600` | `hard 10/12/15`, `compact 12/16/20`, `current 35/45/55`, `memory 10/18/28`, `soft 5/8/12` |
| `proactive_dm` | `reference 6000 / soft 1.15 / hard 1.30 / reserve 700` | `hard 12/14/18`, `compact 14/18/22`, `current 22/28/35`, `memory 14/22/32`, `soft 4/7/10` |
- Sensitive scenes keep the same V2 control compiler pipeline defined in Package 1. No scene may introduce a parallel compiler variant without a new package-level decision.

### Template contract
- Sensitive-scene templates consume only:
  - `hard_control_block`
  - `compact_control_block`
  - `current_context_block`
  - `memory_block`
  - `soft_expression_block`
- Route-level variables such as latest owner message or trigger text are raw inputs to the orchestrator pipeline, not the final budget authority.
- `hard_control_block` retains the ordered `## 隐私与边界` subsection required by Package 1. Sensitive scenes must not reintroduce a separate template-only privacy channel.
- `style` remains inside `soft_expression_block`; sensitive scenes do not get a special style side-channel. `overrides` continue to normalize into `hard / compact / soft`.

### Rollout and dependency rules
- Package 3 depends on Package 1's V2 block contract and Package 2's structured memory tiers.
- Public scenes MUST land first so the V2 template/runtime contract is already proven before sensitive-scene migration.
- Package 2 review gate MUST be closed before Package 3 starts.
- Rollout order:
  1. `private_chat`
  2. `chat_room`
  3. `proactive_dm`
- Review checkpoints are mandatory:
  - after `private_chat`: confirm owner-latest-input survival, block mapping stability, and no route-side final trimming
  - after `chat_room`: confirm `current_context > memory`, memory-rich room samples stay bounded, and room immediacy is preserved
  - after `proactive_dm`: confirm `hard_control` survival, trigger visibility, and boundary fidelity
- `high-value visible actor` thick-envelope promotion is explicitly out of scope for this package. Sensitive-scene migration must prove correctness within the frozen scene configs above.

### Final program closure contract
- Final review MUST verify the full chain:
  - route/service emits raw sources only
  - orchestrator compiles V2 blocks and owns trimming
  - gateway performs passive model-window validation
  - audit/metrics expose bucket survival, overflow reasons, and cost signals
- Final review MUST cover:
  - `forum_post`
  - `forum_comment`
  - `scheduled_post`
  - `private_chat`
  - `chat_room`
  - `proactive_dm`
- Final review MUST compare low / medium / high-memory cohorts across scenes for:
  - `control_survival`
  - `memory_survival`
  - `current-context relevance`
  - `scene fidelity`
  - `private-boundary fidelity`
  - `cost per turn`
  - output variance under similar inputs

## Exit criteria
- Sensitive scenes are fully governed by orchestrator-owned budget authority.
- Current-turn fidelity is encoded in config/raw-source priority rather than relying on incidental prompt order.
- Stress tests show `hard_control` surviving under memory pressure.
- All scene review gates and the final program closure review have been executed and closed.

## Open questions
- none
