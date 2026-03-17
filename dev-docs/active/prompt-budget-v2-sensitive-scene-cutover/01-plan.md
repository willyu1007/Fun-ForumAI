# 01 Plan

## Phases
1. Freeze sensitive-scene raw-source taxonomy and scene-specific budget defaults.
2. Migrate `private_chat` to V2 blocks and owner-current-first allocation.
3. Review `private_chat` artifacts and close the scene gate.
4. Migrate `chat_room` to V2 blocks and current-context-first allocation.
5. Review `chat_room` artifacts and close the scene gate.
6. Migrate `proactive_dm`, then run stress/regression verification across all sensitive scenes.
7. Execute final integrated program review across public + sensitive scenes.

## Detailed steps
- Define per-scene raw-source inputs:
  - `private_chat`: latest owner input, recent session history, optional relationship/session context
  - `chat_room`: recent visible room turns, local role/cue evidence, optional scene continuity
  - `proactive_dm`: trigger evidence, boundary/control context, minimal relationship carryover
- Restate and freeze sensitive-scene defaults from Package 1 so implementation can use them without cross-reading:
  - `private_chat` request budget: `10000 / 1.25 / 1.50 / reserve 900`
  - `chat_room` request budget: `5000 / 1.25 / 1.45 / reserve 600`
  - `proactive_dm` request budget: `6000 / 1.15 / 1.30 / reserve 700`
  - `private_chat` buckets: `hard 10/12/15`, `compact 14/18/22`, `current 24/30/38`, `memory 16/24/36`, `soft 5/8/12`
  - `chat_room` buckets: `hard 10/12/15`, `compact 12/16/20`, `current 35/45/55`, `memory 10/18/28`, `soft 5/8/12`
  - `proactive_dm` buckets: `hard 12/14/18`, `compact 14/18/22`, `current 22/28/35`, `memory 14/22/32`, `soft 4/7/10`
- Replace sensitive-scene legacy template variables with V2 compiled block variables.
- Ensure orchestrator is the only component deciding final block lengths and budget tradeoffs.
- Validate that route/services provide raw evidence only and do not pre-trim final blocks.
- Roll out in fixed order: `private_chat`, `chat_room`, `proactive_dm`.
- Before moving to the next scene, review source priority, block survival, overflow reasons, and cost behavior for the scene just migrated.
- After `proactive_dm`, run a whole-program review across all six scenes to confirm implementation readiness and package completeness.

## Execution gates
1. Source-contract gate:
   - each scene has a frozen raw-source taxonomy before template migration
   - owner current input / room recent turns / proactive trigger are marked high priority in source metadata
2. Package dependency gate:
   - Package 2 review gate is closed before any sensitive-scene implementation starts
3. Allocation gate:
   - orchestrator owns final block lengths
   - scene-specific policies are encoded in config, not in template prose
4. Scene review gate:
   - `private_chat` must be reviewed and signed off before `chat_room` starts
   - `chat_room` must be reviewed and signed off before `proactive_dm` starts
5. Exit gate:
   - sensitive scenes no longer rely on legacy layer semantics as their primary behavior contract
   - current-turn fidelity consistently wins over stale history
   - final integrated review across all packages is closed

## Risks & mitigations
- Risk: private chat still sounds like replayed history instead of responding to the owner.
  - Mitigation: explicitly prioritize latest owner input and session-local evidence.
- Risk: chatroom migration over-preserves memory and loses immediacy.
  - Mitigation: encode `current_context > memory` as a default budget rule, not a best-effort guideline.
- Risk: proactive DM keeps soft flavor at the expense of safety/boundary control.
  - Mitigation: pin `hard_control` as the strongest bucket and keep `soft_expression` minimal.
- Risk: implementation forks a private-scene-specific compiler because one scene feels “special”.
  - Mitigation: freeze one compiler pipeline and express differences only through scene config and raw-source priority.
