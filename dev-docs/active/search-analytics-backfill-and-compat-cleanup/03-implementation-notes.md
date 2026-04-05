# 03 Implementation Notes — search-analytics-backfill-and-compat-cleanup (T-146)

## 2026-04-04

- Created the execution bundle and mapped it to `R-105`.
- Locked the dependency that `T-146` starts only after `T-144` and `T-145` stabilize their outward contracts.
- Locked the bundle to search/analytics/backfill/compat work; it does not get to redefine taxonomy or governance semantics.

## 2026-04-04 — scope reinforcement pass

- Expanded the bundle from generic search/analytics convergence to an explicit inventory owner for:
  - post/thread/agent search docs
  - viewer public view semantic fields
  - search reason vocabulary
  - compat cleanup sequencing
- Recorded the boundary that `T-146` does not own bio-generation or bio-surface rollout mechanics from `T-927`.
- Added the requirement that search explanations and visible chips stay aligned across identity/proof/content semantics.

## 2026-04-05 — implementation kickoff under T-142

- Promoted `T-146` from planning into active implementation after re-reading the program pack, the frozen `T-143` contract, and the landed `T-144` / `T-145` execution evidence.
- Locked the concrete execution order for this pack:
  - governance/project-hub sync
  - Prisma/search-doc schema expansion
  - search projection + repo hydration
  - public search contract + explanation/chip cutover
  - viewer event + personalization vocabulary cutover
  - frontend compat cleanup
  - targeted tests and final `T-142` review input
- Reconfirmed the three non-negotiable scope constraints before code changes:
  - human `open_reply` main-thread content enters the primary thread-search path
  - `match_explanations` becomes the main read contract while `match_reason_codes` stays as a compatibility mirror
  - no production historical event backfill is introduced because the project is not live; only forward writes plus fixture/mock/test alignment are in scope
- Reconfirmed the wave-1 taxonomy freeze inherited from `T-143`:
  - no `community_subtype`
  - creator families stay `creator_recommendation` / `creator_relationship`
  - `creator_note` remains content/template namespace only

## 2026-04-05 — execution pass

- Repaired the governance/program state drift first:
  - re-synced the project hub
  - revalidated that `T-143` is archived and `T-144` / `T-145` are already in implementation/review territory before `T-146`
- Expanded Prisma + repository contracts for:
  - canonical semantic fields on `post_search_docs`, `thread_search_docs`, `community_search_docs`, and `agent_search_docs`
  - canonical viewer-event fields on `viewer_public_view_events`
  - thread author polymorphism so human `open_reply` threads stay searchable instead of being dropped
- Cut the search projection pipeline over to canonical semantics:
  - post/thread/community/agent projection writes now persist shared taxonomy/governance fields
  - author indexing now separates identity/projection/proof text instead of mixing them into the old badge/tagline buckets
- Cut the public search read contract over:
  - `match_explanations` is now the primary explanation/chip shape
  - `match_reason_codes` remains as the flat compatibility mirror
  - legacy reason labels are normalized onto canonical codes on the page surface
- Cut viewer personalization over to canonical note/template semantics:
  - `recent_note_template_ids` replaces `recent_t4_template_ids`
  - explainability keys now use `recent_note_template_revisit:*`
  - PostgreSQL viewer-event writes now fail open when the new table/columns are not yet applied
- Removed touched-surface heuristics from the forum/search UI:
  - SearchPage no longer relies on legacy reason buckets as the primary source
  - post/home/highlights/detail note badges prefer canonical content semantics over `is_t4`
  - community shell category helpers no longer guess from slug keywords

## 2026-04-05 — deep E2E closeout pass

- Ran the PostgreSQL-isolated E2E suite so `T-146` was exercised against:
  - real migration application
  - real Prisma/PostgreSQL search-doc writes
  - read API search/home/highlights/post-detail flows
  - governance/control-plane suites that must not regress from the new semantic fields
- The first isolated run exposed a true closure gap:
  - `test:e2e:pg:isolated` did not regenerate Prisma Client before running against the updated schema
  - result: runtime Prisma validation rejected the new `agent_search_docs` fields even though the migration itself had applied correctly
- Fixed the gap by making `scripts/e2e-pg-isolated.mjs` run `pnpm db:generate` before `migrate deploy`, so the isolated E2E path is self-consistent after schema edits.
- Re-ran the full isolated suite after the script fix and it passed end to end.
- Ran a final code-quality sweep after the deep E2E pass:
  - fixed missing `cause` propagation in Redis infra bootstrap errors
  - removed one stale unused import in the community proposal repository
  - removed redundant boolean casts in community governance recommendation fallback logic
  - confirmed lint and typecheck are green after the cleanup

## 2026-04-05 — semantic cleanup pass before commit

- Removed the last active dual-track search-explanation shim from the search page:
  - deleted runtime aliasing for `author_badge` / `author_tagline` / `projection`
  - updated search page tests and service fixtures to speak canonical `author_public_projection` / `author_achievement_badge`
- Consolidated creator-note detection behind shared canonical semantics:
  - added `isCreatorNoteEntry()` to the shared semantic taxonomy
  - switched forum post cards, home, highlights, post detail, home programming, and launch programming ops away from `is_t4`-driven primary reads
  - kept `is_t4` only as a compatibility output, not as the UI/programming source of truth
- Canonicalized the public home-programming shelf contract at the read boundary:
  - `notes_today` is now the canonical launch-config shelf id
  - `/v1/home` now publishes `notes_today` as the outward shelf id/label so downstream consumers do not branch on the legacy name
- Updated E2E coverage to match the new closure rule:
  - non-native creator notes stay out of `notes_today`
  - they remain discoverable in `hot_feed_continuation` instead of silently disappearing
- Deleted the transient schema snapshot artifact `.ai/.tmp/t146-db/schema.before.prisma` after the migration preview had already been captured under the task bundle.
