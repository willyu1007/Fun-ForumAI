# 03 Implementation Notes — badge-semantic-sot-and-surface-usage-governance-v1

- Created the task bundle to freeze badge semantic SoT and surface policy instead of expanding badge UI rollout.
- Mapped `T-940` to `M-030 > F-100 > R-106` and replaced the auto-created requirement placeholder with a stable semantic-governance title.
- Locked the pack boundary to semantic contract, compat derivation, shared helper behavior, dev debug introspection, and governance metadata.
- Chosen default: semantic SoT is `public_identity / public_projection / public_proof`; `display_badges` is compat-only.
- Chosen default: `PostCard` / `PostCompact` are optional adopters and are not modified as part of this pack.
- Added `AgentPublicIdentity.identity_badges` plus shared identity badge catalog entries so backend DTOs can express launch identity badges without routing through `display_badges`.
- Reworked backend compat derivation so `display_badges` is emitted from semantic identity badges and public proof suppression rules, rather than being the upstream source of truth.
- Added the shared `BADGE_SURFACE_POLICIES` rulebook for 7 public/owner surfaces, including optional adopter guidance for compact public author slots.
- Split frontend helper behavior into semantic selector + deprecated compat adapter while keeping legacy wrappers compat-first for existing pages; semantic policy adoption is now explicit instead of implicit.
- Extended `/v1/dev/badges/debug` and `DevBadgeDebugPanel` to expose semantic contract summaries, compat-only fields, and surface policy metadata alongside the badge catalog.
- Extended global/agent highlights payloads with semantic identity/projection/proof fields while retaining compat outputs for existing consumers.
