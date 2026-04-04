# 01 Plan — governance-and-public-participation-cutover (T-144)

## Phases

1. Map current governance and participation producers/consumers.
2. Redefine publication review, incubation, and three-axis interaction contracts around canonical semantics.
3. Map legacy `A|B|C` and old participation booleans into the new contract.
4. Update governance service, stage/incubation routes, forum gate, and admin controller/surfaces.
5. Add governance and participation cutover tests.
6. Review the governance/interaction contract and close unresolved behavioral questions.
7. Hand off stable API/DTO shapes to `T-146`.

## Key Work Items

- Split publication review and incubation responsibilities.
- Replace `t4_candidate` and `A|B|C` with expressive named fields.
- Define and propagate `public_participation_mode / audience_signal_ingestion / agent_human_response_mode` as one coherent contract.
- Ensure admin tooling cannot reintroduce legacy T4-era terms via UI labels or payloads.
- Ensure `open_reply` is a real first-wave path, not a latent enum with no execution path.

## Required Inputs

- canonical community and interaction contract from `T-143`
- program-level naming and compat rules from `T-142`
- existing governance/admin/stage-spec behavior inventory

## Handoff Contract

- governance payload matrix
- publication/incubation profile split note
- legacy participation mapping table
- admin/forum gate behavior contract
- validation and API payload expectations for downstream search/event consumers

## Pre-Next-Pack Review Gate

- `T-146` may start only after `T-144` review confirms:
  - governance payloads no longer depend on `strict_t4 / t4_candidate / A|B|C` semantics
  - the three-axis interaction contract is complete and explainable
  - `open_reply` has a defined end-to-end behavior path
  - `launch_wave` and `incubation_visibility_mode` usage is explicit
  - no unresolved governance question remains that would change search/event field semantics later

## Exit Criteria

- Governance and public participation terms are canonical and explainable end-to-end.
