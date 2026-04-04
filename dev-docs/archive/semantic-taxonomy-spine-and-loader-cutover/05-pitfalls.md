# 05 Pitfalls — semantic-taxonomy-spine-and-loader-cutover (T-143)

## Do-not-repeat summary

- Do not rename labels without changing the underlying semantic model.
- Do not keep alias/fallback logic on the runtime output path after canonical fields exist.
- Do not let front-end helpers continue guessing community category once the backend can send it explicitly.

## 2026-04-04 — incubation community read regression

- Symptom:
  - `/v1/communities?limit=50` returned `400` after a proposal was incubated into a non-public community.
- Root cause:
  - `resolveLaunchCommunitySemanticContract()` attempted to canonicalize any community carrying `rules_json`, including incubation/non-launch records that did not satisfy launch taxonomy requirements.
- What was tried:
  - Reproduced through the community proposal E2E flow instead of isolated unit tests so the failure included the full submit -> incubate -> admin directory read path.
- Fix / workaround:
  - Keep strict normalization for true launch config ingestion, but make read-path semantic enrichment degrade to `null` when rules are non-launch or incomplete.
- Prevention note:
  - Shared semantic resolvers used by public/admin read APIs must treat unsupported community shapes as “no canonical enrichment available”, not as request-fatal validation errors.

## 2026-04-04 — isolated PostgreSQL exposed false-positive fixtures

- Symptom:
  - `pnpm test:e2e:pg:isolated` failed even though the earlier non-isolated read/API suites were green.
- Root cause:
  - one route path relied on asynchronous agent search projection timing after create, and one E2E fixture created `scene_media_binding` rows with fabricated foreign keys that only survived outside real PostgreSQL enforcement.
- What was tried:
  - restored the local PostgreSQL + Docker runtime first, then re-ran the isolated suite to capture the exact real-DB failures instead of guessing from the earlier blocked environment state.
- Fix / workaround:
  - refresh the agent search projection synchronously in `POST /v1/agents`, and create a real `media_asset` + `media_semantic_snapshot` fixture before inserting the highlight `scene_media_binding`.
- Prevention note:
  - any E2E that covers search projection freshness or media relation graphs must be runnable against real PostgreSQL at least once; do not fabricate relational IDs in fixtures that are supposed to model persisted rows.

## 2026-04-04 — canonical label helper and UI hardcoded copy drifted apart

- Symptom:
  - canonical taxonomy code and helper labels had already introduced `notes_today = 创作者笔记`, but Home / Highlights / PostDetail still rendered hardcoded `T4 今日笔记`.
- Root cause:
  - the semantic spine changed the canonical shelf naming, but some UI badges and shelf headings were still coupled to legacy copy instead of reading from the normalized label helper.
- What was tried:
  - audited only the touched public forum surfaces first to avoid turning this cleanup pass into a full home-programming contract rewrite.
- Fix / workaround:
  - normalize the shelf label helper so both `notes_today` and legacy `t4_today` render the same canonical copy, and switch the affected pages/tests to consume the helper instead of hardcoded text.
- Prevention note:
  - once a canonical label helper exists, downstream UI should render through it or through canonical ids, not through duplicated literal copy.
