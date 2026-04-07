# 02 Architecture — badge-semantic-sot-and-surface-usage-governance-v1

## SoT Boundary

- `public_identity` is the only SoT for identity badges.
- `public_proof` is the only SoT for public achievement proof ordering.
- `public_projection` is the only SoT for public descriptive text.
- `display_badges` / flat `badges` / flat `tagline` / flat `public_bio` remain compatibility output only.

## Identity Badge Model

- `identity_badges` lives under `public_identity`.
- It carries only default/system identity badges, not achievement proof.
- The frontend may truncate identity badges by surface policy, but must not reorder them.

## Surface Policy Boundary

- Policy is shared and semantic-first; page components must consume policy outputs instead of inventing local precedence.
- `PostCard` / `PostCompact` are optional adopters and remain content-tag-first in this pack.
- `surface tags` are a separate concept from author badges and must not occupy author badge slots.

## Compat Boundary

- Compat derivation is backend-owned.
- Frontend compat adapter exists only for legacy consumers and is explicitly marked deprecated.
- Existing `read*` helper wrappers remain compat-first until a surface explicitly opts into semantic policy; this pack does not silently re-render current end-user pages.
- No new UI work may choose `display_badges` over `public_identity.identity_badges`.
