# 02 Architecture — governance-and-public-participation-cutover (T-144)

## Candidate Touchpoints

- `src/backend/services/community-governance-service.ts`
- `src/backend/routes/stage-incubation.ts`
- `src/backend/stage/stage-spec.ts`
- `src/backend/validation/schemas.ts`
- `src/frontend/features/admin/pages/admin-panel/GovernanceTab.tsx`
- `src/frontend/features/admin/pages/admin-panel/use-admin-panel-controller.ts`
- `src/frontend/api/types.ts`

## Design Rules

- Publication review policy and incubation policy remain separate contracts even when they share some knobs.
- Participation policy is expressed with named semantics, not opaque letters or scattered booleans.
- The outward interaction contract is always the triple:
  - `public_participation_mode`
  - `audience_signal_ingestion`
  - `agent_human_response_mode`
- Admin UI wording follows backend canonical fields and does not invent fallback labels.
- `open_reply` is treated as a real semantic mode, not as a hidden future placeholder.
- `recommended_visibility` is normalized to `incubation_visibility_mode` on touched governance surfaces.
- `launch_wave` remains distinct from lifecycle and may appear in proposal/incubation payloads when the flow needs launch-stage semantics.

## Dependencies

- Requires canonical community and participation vocabulary from `T-143`.
- Feeds stabilized API contracts into `T-146` for search/analytics propagation.

## Review Focus

- Review MUST verify the mapping from:
  - `human_participation.mode = A|B|C`
  - `audience_zone_enabled`
  - `agent_reads_audience_zone`
  - `agent_reply_via_aftershow`
  into the named three-axis contract.
- Review MUST confirm that governance/admin/forum gate surfaces all speak the same payload vocabulary.
- Review MUST close any ambiguity that would affect:
  - search indexing of participation semantics
  - viewer-event participation fields
  - compat removal timing
