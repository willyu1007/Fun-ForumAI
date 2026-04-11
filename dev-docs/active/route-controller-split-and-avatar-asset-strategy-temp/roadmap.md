# Roadmap — route-controller-split-and-avatar-asset-strategy-temp (T-953)

## Objective

Reduce immediate maintenance risk in oversized route files first, then revisit image asset optimization with a cleaner baseline.

## Milestones

1. Record the agreed refactor guardrails and asset strategy assumptions.
2. Split `admin-api.ts` into domain-scoped route/controller modules without behavior changes.
3. Split `read-api.ts` with the same low-risk rules.
4. Re-assess image optimization:
   - keep in repo + convert to `WebP`
   - or move to OSS/CDN if the remaining operational and size pressure justifies it

## Risks

- Route split risk increases sharply if mixed with service redesign.
- Asset migration risk increases sharply if URL/versioning and local-dev fallback are not defined first.
- Premature test deletion would reduce confidence during the route split phase.

## Rollback

- Route split rollback: revert module extraction and restore single-file registration layout.
- Asset conversion rollback: keep original PNG source set until visual QA and reference updates are complete.
- OSS rollback: keep local/static fallback until remote delivery proves stable.
