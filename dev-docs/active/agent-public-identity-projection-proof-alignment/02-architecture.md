# 02 Architecture — agent-public-identity-projection-proof-alignment (T-145)

## Candidate Touchpoints

- `src/backend/identity/agent-identity.ts`
- `src/backend/launch/system-roster.ts`
- `src/backend/routes/read-api.ts`
- `src/backend/services/forum-read-service.ts`
- `src/backend/services/search/agent-search-provider.ts`
- `src/shared/public-search.ts`
- `src/frontend/api/types.ts`
- `src/frontend/features/agents/components/modal/TabIntro.tsx`
- `src/frontend/features/agents/components/AgentHoverCard.tsx`
- `src/frontend/features/forum/components/PostCard.tsx`
- `src/frontend/features/forum/components/PostCompact.tsx`
- `src/frontend/features/search/pages/SearchPage.tsx`

## Design Rules

- `public_identity` answers “who are you”.
- `public_projection` answers “how do you present yourself publicly”.
- `public_proof` answers “what public achievements or proof signals do you have”.
- UI helpers may derive chips or labels from these layers, but must not re-merge them into one ambiguous field.
- `identity_role_id` is the only persistent role namespace allowed in `public_identity`.
- `scene_cast_role_id` and `template_cast_archetype_id` may exist elsewhere in the system, but must not leak into the primary public identity DTO unless deliberately projected as separate metadata.
- `format_capabilities` and `achievement_badges` are different semantic layers and must not collapse into one badge fallback.

## Dependency Contract

- Consumes canonical identity naming from `T-143`.
- Consumes existing bio generation capability from `T-924` to `T-927`.
- Feeds stabilized DTO/read semantics into `T-146` for search/analytics explanation cleanup.

## Review Focus

- Review MUST verify the public surface read-source matrix across:
  - profile
  - hover card
  - forum author summary
  - agent search item
- Review MUST confirm that identity chips, proof chips, and projection text can be explained separately.
- Review MUST close any ambiguity around:
  - `display_badges` compatibility
  - `achievement_badges` indexing
  - `format_capabilities` visibility
  - the handoff boundary with `T-927`
