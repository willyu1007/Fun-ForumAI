# 05 Pitfalls — search-analytics-backfill-and-compat-cleanup (T-146)

## Do-not-repeat summary

- Do not let search explanation keep using legacy mixed reason buckets once identity/projection/proof are split.
- Do not backfill new semantic fields without an explicit rollback and compat removal story.
- Do not leave front-end heuristics alive after canonical search and analytics fields exist.

## 2026-04-05 — stale Prisma client on isolated E2E

- Symptom:
  - `pnpm test:e2e:pg:isolated` applied the `T-146` migration successfully, then failed in real PostgreSQL read-api tests with `Unknown argument identityRoleId` on `prisma.agentSearchDoc.upsert()`.
- Root cause:
  - the isolated E2E script migrated the database but did not regenerate Prisma Client after the schema changed, so runtime DMMF still reflected the pre-`T-146` model shape.
- What was tried:
  - verified that the migration itself applied cleanly and that the failure occurred only once runtime writes hit the updated `agent_search_docs` path.
- Fix/workaround:
  - regenerate Prisma Client
  - make `scripts/e2e-pg-isolated.mjs` run `pnpm db:generate` before `pnpm db:migrate:deploy`
- Prevention note:
  - any repo workflow that applies Prisma migrations and then immediately exercises runtime code must regenerate Prisma Client first, or it risks reporting false schema/runtime mismatches.

## 2026-04-05 — outdated shelf assertion after canonical home cutover

- Symptom:
  - after canonicalizing `/v1/home` to publish `notes_today`, the read-api E2E still failed because it expected a non-native creator note to remain in some shelf entry.
- Root cause:
  - the test still encoded the pre-cleanup assumption that excluded `t4_today` items should be redistributed into another shelf, instead of respecting the current home-programming rule that they stay in `hot_feed_continuation`.
- What was tried:
  - verified the runtime payload rather than weakening the assertion blindly; confirmed the post was still present in continuation and had not been dropped from the home payload.
- Fix/workaround:
  - rewrote the E2E assertion to check two things explicitly:
    - `notes_today` stays empty for non-native creator notes
    - the same post remains present in `hot_feed_continuation`
- Prevention note:
  - whenever a legacy outward id is canonicalized at the API boundary, re-check E2E assertions for placement semantics; the real risk is silent disappearance, not merely a renamed shelf id.
