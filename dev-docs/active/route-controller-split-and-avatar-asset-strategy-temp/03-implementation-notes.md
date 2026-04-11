# 03 Implementation Notes — route-controller-split-and-avatar-asset-strategy-temp

## 2026-04-11 — Discussion Alignment Snapshot

- Confirmed that previously tracked deletions are now resolved (`git ls-files -d` returned `0`).
- Agreed to take the low-risk controller split path first.
- Explicitly decided not to mix route splitting with service redesign in the first pass.
- Asset discussion remains open, but the current lean is:
  - do not treat suffix rename as conversion
  - prefer real `WebP` re-encoding if compression is pursued
  - consider OSS only after route work lands and the residual pain is still meaningful
- Test files are not the first target; revisit them only after the production refactor shape stabilizes.

## 2026-04-11 — PNG/WebP Coverage Check

- `public/` currently contains `79` tracked PNG files and `79` tracked WebP files.
- Basename comparison for `public/` returned full one-to-one coverage:
  - no PNG without a same-path WebP sibling
  - no extra WebP without a same-path PNG source
- Dimension check across all `public/*.png -> *.webp` pairs returned:
  - `checked=79`
  - `missing=0`
  - `mismatched=0`
- This means the generated WebP set appears complete for the `public` asset set.
- Deletion is still blocked by live `.png` references in production code and dev fixtures, including:
  - `src/frontend/shared/utils/preset-avatars.ts`
  - `src/frontend/shared/utils/community-shell-meta.ts`
  - `src/backend/dev/dev-seed-fixtures.ts`
- Separate repo-wide note:
  - total tracked PNG files in repo: `206`
  - non-`public` PNG files are mainly Playwright snapshot baselines plus `src/frontend/assets/logo.png`

## 2026-04-11 — Safe Migration Executed

- Added `src/frontend/shared/utils/public-asset-url.ts` to normalize local preset/static avatar asset URLs from `.png` to `.webp` for known public asset prefixes.
- Updated `AvatarImage` so direct `avatar_url` payloads carrying legacy local `.png` paths are normalized at render time.
- Switched frontend preset constants to `webp` in:
  - `src/frontend/shared/utils/preset-avatars.ts`
  - `src/frontend/shared/utils/community-shell-meta.ts`
- Updated direct image-rendering call sites to normalize local asset-backed `media_url` / `thumbnail_url` values before render.
- Updated `src/backend/dev/dev-seed-fixtures.ts` so future seeded records write `webp` URLs and `image/webp` MIME types instead of PNG.
- Deleted tracked PNG files only under:
  - `public/agent-avatars/`
  - `public/community-avatars/`
  - `public/user-avatars/`
- Intentionally kept other public PNG files in place:
  - `public/apple-touch-icon.png`
  - `public/pwa-192.png`
  - `public/pwa-512.png`
- Important workspace note:
  - the generated `public/**/*.webp` files existed before this edit pass and are currently still untracked in git status
  - some unrelated badge asset changes are also present in the worktree and were left untouched

## 2026-04-11 — Asset Path Single-Track Cleanup

- Removed the frontend runtime compatibility layer that previously rewrote known local avatar asset URLs from `.png` to `.webp`.
- Deleted `src/frontend/shared/utils/public-asset-url.ts` and removed all imports/usages from avatar/media/banner rendering surfaces.
- Resulting behavior is now intentionally strict:
  - preset/static sources resolve directly to `.webp`
  - persisted/local `.png` paths are no longer silently rewritten at render time
  - any stale `.png` data will now fail visibly instead of being masked
- Cleaned runtime favicon/PWA references:
  - removed the deleted `/favicon.svg` link from `index.html`
  - kept `/favicon.ico` as the browser icon
  - kept `/apple-touch-icon.png` as the iOS touch icon
  - removed `public/pwa-192.png` and `public/pwa-512.png`
- Community banner assets are now single-format:
  - tracked `public/community-banners/*.svg` files removed
  - `public/community-banners/*.webp` retained as the only shipped banner assets

## 2026-04-11 — Backend Typecheck Baseline Repaired

- Fixed the `SearchProjectionDeps` contract in `agent-deletion-service.ts` so `AgentDeletionService` accepts the actual reconcile dependency shape without constraining return values that callers ignore.
- Propagated `Agent.status` through public-author presentation call sites in:
  - `forum-read-service.ts`
  - `search-projection-service.ts`
  - `search/agent-search-provider.ts`
  - `search/post-search-provider.ts`
  - `search/thread-search-provider.ts`
- Normalized search-hit agent status before feeding it into public-author presentation so provider code no longer relies on an untyped string.
- Extended hot-topic/stat hard-control status handling to include `DELETED` in:
  - `policy-gateway-service.ts`
  - `stat-deriver.ts`
- Result: repository-wide `pnpm typecheck` is now clean again.

## 2026-04-11 — Low-Risk Route Split Phase 1

- Extracted admin review/support routes into `src/backend/routes/admin/admin-review-routes.ts`, covering:
  - moderation queue / case actions
  - admin feedback routes
  - admin invite-code routes
  - admin user access routes
  - identity review routes
- Extracted read-side feedback/appeal routes into `src/backend/routes/read/read-feedback-routes.ts`, covering:
  - user feedback create/list/detail/attachment routes
  - complaint report create/list routes
  - appeal create/list routes
- Kept `admin-api.ts` / `read-api.ts` as composition roots that register the extracted route groups at the original registration points.
- Maintained low-risk constraints:
  - no path changes
  - no middleware order changes
  - no validator changes
  - no response contract changes
  - no service/repository contract redesign
- Current file-size snapshot after phase 1:
  - `src/backend/routes/admin-api.ts`: `1254` lines
  - `src/backend/routes/read-api.ts`: `1454` lines
  - newly extracted modules:
    - `src/backend/routes/admin/admin-review-routes.ts`: `441` lines
    - `src/backend/routes/read/read-feedback-routes.ts`: `239` lines
