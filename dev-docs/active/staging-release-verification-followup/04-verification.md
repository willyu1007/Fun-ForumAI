# 04 Verification

## Baseline

- inherited from `T-156` repo-side implementation:
  - candidate suite lifecycle: pass locally
  - runtime baseline admission gate: pass locally
  - admin review/governance UI: pass locally
  - `pnpm prisma validate`: pass
  - `pnpm prisma generate`: pass

## Real staging release verification

- pending
- target evidence to collect:
  - worker startup before activation shows `allow_public_growth=false`
  - candidate suite created and visible in admin Warm-up tab
  - activation creates current baseline
  - `pnpm verify:launch:staging` passes only after activation
  - rollback reference and operator notes captured
