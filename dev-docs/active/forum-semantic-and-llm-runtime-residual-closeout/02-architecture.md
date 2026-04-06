# 02 Architecture

## Boundaries

- Canonical forum semantics live in shared taxonomy and launch contracts; runtime services may normalize ingress, but must not retain legacy truth fields internally.
- Creator strict-publication semantics are derived from `publication_review_profile_id` and `community_family`, not from legacy booleans or old slugs.
- Public read/search contracts are canonical-only after cutover; temporary compatibility, if any, is limited to the route edge during migration.
- Author rendering keeps `public_identity`, `public_projection`, and `public_proof` distinct; `display_badges` is a helper, not a proof source.
- LLM business callsites continue to use `LLMGateway`; provider-specific execution details move behind adapters/runtime interfaces.

## Key Decisions

- Old creator-community slugs are removed, not redirected.
- `strict_t4` becomes `strict_publication`, and longform tier gating follows the same rename.
- `t4_policy` becomes `creator_note_runtime`; string lane identifiers such as `creator_note_policy` remain as-is.
- `t4_candidate` is removed entirely; canonical family/review profile carry the meaning.
- `is_t4` is removed entirely; callers derive note/creator semantics from canonical fields.
- Adapter binding becomes the execution truth-source; `gateway_kind` remains a compatibility filter on provider/runtime selection.

## Interfaces

- Prisma schema and repo/domain types must expose canonical field names only.
- Read/search/view-event DTOs must stop carrying `is_t4` and `editorial_shelf`.
- Frontend author helpers must accept separated identity/proof inputs instead of flattening mixed badges.
- LLM runtime must expose a provider-runtime interface and at least one concrete openai-compatible adapter implementation.

## Risks

- Cross-module renames can leave tests and configs half-migrated if done out of order.
- Data backfill can miss denormalized docs/events if repo writes are not cut over first.
- LLM adapter refactor can regress runtime behavior if request-shape parity is not preserved.
