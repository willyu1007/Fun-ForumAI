# 05 Pitfalls — admin-community-media-import-console (T-302)

## Do Not Repeat

- Do not solve online import by adding new media tables before proving existing media pools are insufficient.
- Do not bypass semantic snapshot, binding, or reuse policy creation.
- Do not make community commons default to broad original quoting without an explicit product decision.
- Do not reuse existing platform canonical registration as-is; it currently enables quote-original by default and must become explicit for T-302.
- Do not turn phase 1 into a full DAM, bulk import, or asset lifecycle management project.
- Do not start product code changes before roadmap questions are closed.
- Do not update routes without updating `docs/context/api/openapi.yaml` and regenerating the API index in the same batch.
- Do not mark retrieval `ready` unless existing retrieval/embedding records are actually searchable.
- Do not break existing community preset avatar/banner selection while replacing the upload placeholder.
- Do not expose `operator_note` as a phase-1 stable API field unless durable persistence is explicitly approved.
- Do not let community import auto-save banner/avatar; import and community surface save remain separate actions.

## Resolved Issues Log

- 2026-04-26: Open roadmap questions are closed; implementation may proceed after execution runbook confirmation.
- 2026-04-26: Coverage review closed planning gaps and added per-slice review gates.

## Execution-Time Findings (2026-04-27)

- **Flipping `allow_quote_original` to false on `registerPlatformCanonicalAsset` is not enough by itself.** Two helper functions inside `media-reuse-governance-service.ts` had hardcoded platform-canonical behavior that silently ignored the flag:
  - `defaultModesForSource` previously returned `['quote_original', 'derive_new', 'reference_only']` unconditionally for `platform_canonical`. Future changes must keep this branched on `allow_quote_original`, mirroring the `community_commons` arm.
  - `defaultCrossAgentQuoteAllowed` previously returned `true` unconditionally for `platform_canonical`. Future changes must keep it returning `Boolean(allowQuoteOriginal)`.
  - Lesson: when introducing a flag at a service entry point, audit every helper that branches on the same `source_kind` — a flag added at the top is a no-op if the helpers underneath don't honor it.
- **`ctl-openapi-quality` does not resolve `$ref` for path parameters.** Community-scoped paths (`/v1/admin/communities/{communityId}/...`) had to declare `communityId` inline rather than reuse `#/components/parameters/CommunityIdParam`. Matches the existing convention in this file; do not "improve" by switching to `$ref`.
- **Container test access requires explicit re-export.** Adding `vi.spyOn(mediaAssetService, 'ingestManagedRemoteAsset')` in route integration tests required exporting `mediaAssetService` from `src/backend/container/index.ts` (it was previously only used internally inside `llm.ts`). Future T-302-style stubs of internal services should expect this export step.
- **Test environment retrieval status is always `pending` (`backfill_required`).** With `mediaRetrievalV1=false` (the default test config), `ensureDocumentEmbedding` records `search_status: 'backfill_required'` rather than `searchable`. Route integration tests assert on the schema (`status` is one of `ready|pending|failed`); use the dedicated service unit test to exercise the `ready` and `failed` branches with manufactured embedding snapshots.
- **Community-scoped import must validate the community before any media write.** Post-merge review found that the OpenAPI contract promised 404 for missing communities, but the implementation accepted arbitrary path ids and could create orphan `community_commons:<id>` pools. Prevention: keep `AdminMediaImportService.communityContext` and `MediaReuseGovernanceService.registerCommunityCommonsAsset` backed by `communityRepo.findById`; test upload, URL import, list, and the low-level commons registration route for missing-community 404.
- **`@testing-library/jest-dom` is not installed.** Use plain Vitest matchers (`toBeDefined()`, `(el as HTMLInputElement).checked`, `(el as HTMLButtonElement).disabled`) — `toBeInTheDocument()` / `toBeChecked()` / `toBeDisabled()` will fail with `Invalid Chai property`.
- **Radix Tabs controlled state did not flip via `fireEvent.click` in the panel test environment.** The test that originally tried to switch tabs and then locate the URL submit button failed to find the button after click. The current test suite avoids needing a tab switch by asserting on the existence of both tab triggers and structuring assertions on the default (upload) tab content. If a test ever needs to programmatically switch tabs, prefer driving it via `userEvent` rather than `fireEvent.click`.
