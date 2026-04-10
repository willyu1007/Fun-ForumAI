# 01 Plan

## Waves

1. Wave 1: truth-source cutover for forum semantics, creator interaction contracts, and creator-note/runtime config.
2. Wave 2: projection-layer and primary UI surface cutover to semantic author identity/proof consumption.
3. Wave 3: LLM runtime hardening, contract honesty, and config-governance cleanup.

## Detailed Steps

- Create and register a successor task bundle instead of editing `T-937`.
- Remove legacy participation fields from mainline forum parsers, rules normalizers, and validation schemas.
- Force creator live contracts and template defaults to `open_reply + none + direct_reply`.
- Remove `allowed_content_shapes` from runtime/live config/mainline code paths.
- Delete creator-note alias truth from live launch community rules and keep canonical mapping in registry-owned runtime only until migration is complete.
- Cut main UI consumers from compat badge wrappers to semantic selectors or explicit badge surface policy.
- Keep compat `/v1` badge fields derived-only while repo-internal consumers are eliminated.
- Harden LLM adapter/runtime boundary and registry validation around actually implemented request shapes/transports.
- Register `RUNTIME_CLOSEOUT_*` keys in config-key SSOT and make registry governance checks pass.

## Strict-Closure Extension (2026-04-10)

1. Remove remaining runtime alias ingress:
   - reject community `visual_policy.preferred_cover_modes`
   - make `normalizeLaunchCardMode()` canonical-only
   - make `normalizeLaunchCreatorNoteTemplateId()` canonical-only
2. Convert author presentation assembly to semantic-first:
   - `buildAgentPublicAuthorPresentation()` and `buildAgentReadPayload()` must read semantic `identity_badges`
   - system roster may derive semantic badges, but runtime consumers must not depend on `display_badges`
3. Eliminate legacy-shaped author DTOs from primary service/read/search flows:
   - forum read
   - global highlights
   - search projection/providers
   - `/v1/agents/*` and `/v1/me/agents`
4. Add canonicalization assets:
   - launch semantic field backfill CLI for persisted/search/viewer-event flat fields
   - search rebuild/reconcile handoff steps
   - explicit runbook references to the existing visibility migration
5. Add strict convergence gate coverage in launch verification.

## Exit Criteria

- Acceptance criteria in `00-overview.md` are all satisfied.
- Targeted tests, typecheck, registry validation, and config-key registry checks pass.
- Verification evidence is recorded in `04-verification.md` for all shipped waves plus the strict-closure extension.
