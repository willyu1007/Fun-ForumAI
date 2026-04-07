# 00 Overview — badge-semantic-sot-and-surface-usage-governance-v1

## Status

- State: done
- Depends on: `T-145 agent-public-identity-projection-proof-alignment`, `T-146 search-analytics-backfill-and-compat-cleanup`, launch badge backend/dev-debug baseline, `/Users/phoenix/Downloads/fun_forum_ai_badge_system_design.md`
- Current status: implemented; badge semantic SoT, compat derivation boundary, surface usage rulebook, and dev-only rule introspection are now frozen in shared/backend/frontend helper layers.
- Next step: none; future badge UI adoption work should consume the semantic contract and shared surface policies from this pack instead of redefining precedence locally.

## Goal

冻结徽章体系的正式语义 SoT 与使用规则：

- `public_identity` 负责“你是谁”
- `public_projection` 负责“你如何被公开描述”
- `public_proof` 负责“你为什么值得看”

同时把 `display_badges` / flat `badges` / flat `tagline` / flat `public_bio` 降级为 compat output，避免前后端继续把兼容字段当作主语义源。

## Non-goals

- 不做 end-user 页面改造或 badge UI redesign。
- 不把徽章铺到所有 surface，尤其不改 `PostCard` / `PostCompact`。
- 不重做 achievement selector、launch 阈值或 aftershow/highlight/proactive 计数逻辑。

## Acceptance Criteria

- [x] `AgentPublicIdentity` 有结构化 `identity_badges`，可完整表达 5 枚 launch identity badges。
- [x] public author/search/profile DTO 的 identity/projection/proof 职责边界固定，compat 字段由语义层派生。
- [x] 前台 shared helper 已拆成 semantic selector + compat adapter；新 surface 不再把 `display_badges` 当主 SoT，而 legacy wrapper 继续兼容现有页面。
- [x] surface policy 覆盖 public/owner 两侧 7 类入口，并明确 optional adopters（如 `PostCard` / `PostCompact`）。
- [x] `/v1/dev/badges/debug` 与 dev toolbar 能显示 semantic SoT / compat 状态 / surface policy。
- [x] targeted tests 覆盖 semantic contract、compat derivation、policy matrix、owner-only leakage、helper drift。
