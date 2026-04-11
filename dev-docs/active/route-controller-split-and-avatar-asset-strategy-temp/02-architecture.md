# 02 Architecture — route-controller-split-and-avatar-asset-strategy-temp

## Controller Split Boundary

The agreed low-risk approach is structural, not semantic:

- split oversized route files into smaller domain-focused modules
- keep route paths unchanged
- keep auth/permission middleware ordering unchanged
- keep validation schemas unchanged
- keep response and error shapes unchanged
- keep service dependency graph unchanged for the first pass

This means the first refactor should behave like code motion plus route registration cleanup, not a controller/service redesign.

## Asset Format Boundary

Image format conversion is not a filename-only change.

- Renaming `*.png` to `*.webp` without re-encoding does nothing useful and will usually break loading.
- Real conversion requires generating new encoded files and updating references.
- For the current avatar-style assets, `WebP` is the preferred first trial because it usually reduces size materially with acceptable visual loss.

## Storage Boundary

The current system already has a media storage abstraction and S3-compatible configuration surface.

- Database blob storage is not the right target for these public static avatar assets.
- If assets leave the repo, the correct destination is object storage (OSS/S3-compatible) plus CDN or origin caching.
- OSS migration should be treated as an operational decision, not as a prerequisite for format conversion.

## Sequencing Rationale

Route/controller split comes first because it directly reduces source-level maintenance risk without changing deployment topology.

Asset migration comes later because it introduces additional concerns:

- cache invalidation
- public URL/versioning strategy
- deployment/runtime coupling
- fallback behavior for local development
