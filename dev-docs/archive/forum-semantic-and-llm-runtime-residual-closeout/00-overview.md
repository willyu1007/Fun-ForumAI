# 00 Overview — forum-semantic-and-llm-runtime-residual-closeout (T-937)

## Status

- State: done
- Depends on: `T-142`, `T-145`, `T-146`, `T-901`
- Next step: archived; open a separate follow-on only if new residuals appear

## Goal

Close the residual real issues left after the earlier semantic/governance and provider-runtime programs:

- creator-community slug and naming drift still present in runtime/config
- governance and incubation still depend on legacy `t4*` truth fields
- read-model/API/analytics still emit legacy semantic fields
- author presentation still mixes identity and proof in major UI surfaces
- LLM gateway still plans by adapter but executes by direct client dispatch

## Non-goals

- Add a new public API version.
- Preserve old creator-community URLs or aliases.
- Implement a real native-provider runtime.
- Reopen or rewrite historical task bundles that are already archived or marked done.

## Scope

- Shared semantic taxonomy and launch config contracts
- Stage/governance/proposal/incubation backend services
- Prisma schema, migrations, and semantic backfill
- Read API, search/analytics projections, and relevant frontend surfaces
- LLM gateway/runtime interface and registry validation

## Acceptance criteria (high level)

- [x] Creator communities use only canonical slugs and canonical governance semantics.
- [x] Backend/runtime paths no longer depend on `strict_t4`, `t4_candidate`, `is_t4`, or old creator slugs.
- [x] `/v1` read payloads and frontend surfaces no longer expose or depend on `is_t4` and `editorial_shelf`.
- [x] Author presentation separates identity and proof on post detail, hover card, and related surfaces.
- [x] LLM execution is adapter-first, and registry validation blocks invalid direct fallback targets.

## Current status

- Historical task bundles remain reference material; this task owns the final closeout implementation and verification.
- Residual compatibility ingress and stale archive artifacts were removed in a final cleanup round on 2026-04-06.
- The April 9 semantic convergence hard-cut has been implemented:
  - public read-model/API/UI paths are nested-contract-first and no longer emit flat semantic duplicates
  - launch authoring is constrained to canonical `authoring_shapes`, authoring-only `discussion_seed_types`, and `preferred_card_modes`
  - governance control-plane compatibility for `visibility_mode` / `recommended_visibility` has been removed
- The follow-on repo-wide TypeScript cleanup has also been completed:
  - `pnpm exec tsc -b` now passes after aligning auth test fixtures, allocator async tests, media/runtime mock shapes, and stale forum-read visual assertions with current canonical behavior
- The April 9 runtime-authority hard-cut has also been implemented:
  - visible/private route planning now resolves only through `registry -> generated routing artifact -> gateway`
  - `preferredModelId`, `policyTags`, `agent.model`, deprecated runtime override state, and dead visible pins were removed from active runtime control paths
  - agent create/read/public-search contracts no longer expose compatibility-model semantics
