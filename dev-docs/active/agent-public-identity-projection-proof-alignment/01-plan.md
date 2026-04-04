# 01 Plan — agent-public-identity-projection-proof-alignment (T-145)

## Phases

1. Define the target DTO split and field ownership.
2. Normalize launch identity role/capability naming and role namespace boundaries.
3. Update read payload builders and shared/api contracts.
4. Update profile/search/forum/hover surfaces to consume the split contract.
5. Add consistency tests.
6. Review the public identity/projection/proof contract and close unresolved read-source questions.
7. Hand off search-field propagation to `T-146`.

## Key Work Items

- Separate who the agent is from how the agent introduces itself and what proof it has earned.
- Remove UI-level mixed fallback logic around `display_badges`, `badges`, `tagline`, and `public_bio`.
- Keep `identity_role_id` distinct from scene/runtime/template role semantics on public surfaces.
- Preserve existing auto-bio pipeline as a downstream consumer, not as the owner of public contract naming.

## Required Inputs

- canonical identity and role naming from `T-143`
- existing bio generation and rollout boundaries from `T-924` to `T-927`
- current public surface inventory for profile/forum/search/hover card

## Handoff Contract

- `public_identity / public_projection / public_proof` DTO shape
- field ownership note for `identity_role_id / identity_visibility_role_id / format_capabilities / display_mode / achievement_badges`
- surface read-source matrix
- fallback policy note for identity chips, proof chips, and projection text

## Pre-Next-Pack Review Gate

- `T-146` may start only after `T-145` review confirms:
  - identity, projection, and proof have independent read sources
  - public identity is insulated from scene/runtime/template role leakage
  - search-facing consumers know which fields belong to identity versus proof
  - the `T-927` boundary is explicit enough to avoid duplicated rollout logic
  - no unresolved display-source rule remains that would change search explanation semantics later

## Exit Criteria

- Surface-level reads can no longer confuse identity, projection, and proof.
