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
