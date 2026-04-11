# 04 Verification — route-controller-split-and-avatar-asset-strategy-temp

## 2026-04-11

- `git ls-files -d | wc -l`
  - Result: `0`
  - Meaning: previously discussed tracked deletions are no longer present.

- Repository/media inspection was used to support planning only.
  - No code changes, builds, tests, or runtime verification were executed for this temporary planning bundle.

- `rg --files public | rg '\.png$' | wc -l`
  - Result: `79`

- `rg --files public | rg '\.webp$' | wc -l`
  - Result: `79`

- Basename diff between `public/*.png` and `public/*.webp`
  - Result: no unmatched entries in either direction
  - Meaning: `public` coverage is complete at the filename/path level

- `sips` dimension audit for all `public/*.png -> *.webp` pairs
  - Result: `checked=79 missing=0 mismatched=0`
  - Meaning: each generated WebP matches the original PNG dimensions

- `rg -n '\.png\b' src/frontend src/backend/dev public | rg -v '(__tests__/|\.test\.)'`
  - Result: production/dev-support code still contains hardcoded `.png` asset URLs
  - Meaning: deleting `public` PNG files immediately would break current references unless code/data is updated first

## 2026-04-11 — After Migration

- `rg -n '\.png\b' src/frontend src/backend/dev -g '!**/__tests__/**' -g '!**/*.test.*'`
  - Result: remaining `.png` mentions are limited to:
    - the normalization helper implementation itself
    - a user-facing placeholder URL example
    - screenshot filename generation for private-chat capture flow
  - Meaning: no remaining production/development-support references to local avatar preset PNG paths

- `rg -n '/agent-avatars/.*\.png|/user-avatars/.*\.png|/community-avatars/.*\.png' src/frontend src/backend/dev -g '!**/__tests__/**' -g '!**/*.test.*'`
  - Result: no matches
  - Meaning: source-level local preset avatar references are fully migrated away from PNG

- `pnpm test -- --run src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/forum/components/__tests__/PostCompact.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx`
  - Result: `5` test files passed, `34` tests passed
  - Meaning: targeted frontend behavior around the migrated avatar/media surfaces remained green

- `pnpm build`
  - Result: passed
  - Meaning: frontend production build still succeeds after the migration and PNG deletions

- `find public/agent-avatars public/community-avatars public/user-avatars -type f -name '*.png' | wc -l`
  - Result: `0`
  - Meaning: avatar PNGs were removed only from the intended directories

- Remaining public PNG files:
  - `public/apple-touch-icon.png`
  - `public/pwa-192.png`
  - `public/pwa-512.png`
  - Meaning: PWA / iOS icon assets were intentionally preserved

- Local WebP reference existence check
  - Result: `missing_webp_refs=0`
  - Meaning: every migrated local `webp` asset reference found in source resolves to a file in `public/`

- `pnpm typecheck`
  - Result: failed on pre-existing backend type errors unrelated to this migration
  - Meaning: repository-wide typecheck baseline is currently not clean; not treated as a blocker for this asset migration

## 2026-04-11 — Backend Type + Route Split

- `pnpm typecheck`
  - Result: passed
  - Meaning: previously recorded backend TypeScript baseline issues are resolved

- `pnpm test -- --run src/backend/services/__tests__/agent-deletion-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/backend/services/__tests__/stats-service.test.ts src/backend/routes/__tests__/admin-moderation-api.test.ts src/backend/routes/__tests__/admin-user-access-api.test.ts src/backend/routes/__tests__/admin-invite-codes-api.test.ts src/backend/routes/__tests__/feedback-api.test.ts`
  - Result: `8` test files passed, `30` tests passed
  - Meaning: the type-fix surface and the first extracted admin/read route groups remained behaviorally stable

- `wc -l src/backend/routes/admin-api.ts src/backend/routes/admin/admin-review-routes.ts src/backend/routes/read-api.ts src/backend/routes/read/read-feedback-routes.ts`
  - Result:
    - `src/backend/routes/admin-api.ts`: `1254`
    - `src/backend/routes/admin/admin-review-routes.ts`: `441`
    - `src/backend/routes/read-api.ts`: `1454`
    - `src/backend/routes/read/read-feedback-routes.ts`: `239`
  - Meaning: route composition is now split across dedicated modules while preserving the original root routers

## 2026-04-11 — Asset Single-Track Finalization

- `rg -n "/agent-avatars/.*\\.png|/user-avatars/.*\\.png|/community-avatars/.*\\.png|/community-banners/.*\\.svg|favicon\\.svg|pwa-192\\.png|pwa-512\\.png" src public index.html -g '!**/__tests__/**' -g '!**/*.test.*'`
  - Result: no matches
  - Meaning: production/source-level references to retired local avatar PNGs, community-banner SVGs, and removed favicon/PWA paths are gone

- `find public/community-banners -maxdepth 1 -type f | sort`
  - Result: only `*.webp` files remain
  - Meaning: community banners are now shipped as a single format

- `ls public | rg 'favicon|pwa|apple'`
  - Result:
    - `apple-touch-icon.png`
    - `favicon.ico`
  - Meaning: runtime icon chain is reduced to the kept iOS touch icon plus the kept favicon

- `pnpm test -- --run src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/forum/components/__tests__/PostCompact.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx src/frontend/features/forum/pages/__tests__/CommunityFeedPage.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/backend/services/__tests__/agent-deletion-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/backend/services/__tests__/stats-service.test.ts src/backend/routes/__tests__/admin-moderation-api.test.ts src/backend/routes/__tests__/admin-user-access-api.test.ts src/backend/routes/__tests__/admin-invite-codes-api.test.ts src/backend/routes/__tests__/feedback-api.test.ts`
  - Result: `14` test files passed, `68` tests passed
  - Meaning: the no-compat asset cleanup and current route/type changes remained stable across targeted frontend and backend coverage

- `pnpm typecheck`
  - Result: passed
  - Meaning: asset cleanup did not reintroduce TypeScript regressions

## 2026-04-11 — Route Split Phase 2

- `pnpm typecheck`
  - Result: passed
  - Meaning: extracting admin runtime/control-plane routes and read policy/audience routes did not leave type-level regressions

- `pnpm test -- --run src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
  - Result: `2` test files passed, `62` tests passed
  - Meaning: the second batch of extracted route groups preserved the original read/admin runtime behavior

- `wc -l src/backend/routes/admin-api.ts src/backend/routes/read-api.ts src/backend/routes/admin/admin-review-routes.ts src/backend/routes/admin/admin-runtime-routes.ts src/backend/routes/read/read-feedback-routes.ts src/backend/routes/read/read-policy-routes.ts`
  - Result:
    - `src/backend/routes/admin-api.ts`: `591`
    - `src/backend/routes/read-api.ts`: `1362`
    - `src/backend/routes/admin/admin-review-routes.ts`: `441`
    - `src/backend/routes/admin/admin-runtime-routes.ts`: `668`
    - `src/backend/routes/read/read-feedback-routes.ts`: `239`
    - `src/backend/routes/read/read-policy-routes.ts`: `107`
  - Meaning: root router files are materially smaller while extracted route modules now hold the moved low-coupling handler groups
