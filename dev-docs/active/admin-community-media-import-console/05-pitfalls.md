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
