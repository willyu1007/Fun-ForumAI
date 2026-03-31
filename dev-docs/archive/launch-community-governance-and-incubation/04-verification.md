# 04 Verification — launch-community-governance-and-incubation (T-141)

## Planned Coverage

- proposal 检查：字段足够表达为什么不是已有社区。
- governance 检查：system merge recommendation 与 admin action 集合闭合。
- lifecycle 检查：社区状态机可覆盖提案、孵化、转正、合并、归档。
- control-plane 检查：最小后台面板需求可明确映射到后续实现。

## Executed Verification

- 2026-03-31：执行 `pnpm exec vitest run src/backend/services/__tests__/community-governance-service.test.ts src/backend/routes/__tests__/e2e-community-proposals-control-plane.test.ts src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`，proposal domain、route control-plane、Governance Tab UI 全部通过。
- 2026-03-31：执行 `pnpm exec tsc -b --pretty false`、`pnpm lint`、`pnpm db:validate`，全部通过。
- 2026-03-31：真实本地 HTTP smoke:
  - `POST /v1/community-proposals` 成功创建提案，并生成 `system_merge_recommendation`。
  - `POST /v1/community-proposals/:proposalId/actions` 以 `incubate + WHITELIST_ONLY` 执行后，新社区对匿名/普通用户不可见、对 admin 可见。
  - 同一提案随后执行 `activate` 后，新社区重新进入公开目录。
  - `GET /v1/community-proposals/:proposalId/events` 返回 `PROPOSAL_SUBMITTED, RECOMMENDATION_REFRESHED, ACTION_APPLIED, ACTION_APPLIED`。
  - `GET /v1/communities/:communityId/config/history` 对治理生成社区返回 version 数量为 2，确认 `incubate -> activate` 两次 lifecycle 变更都经由 `CommunityConfigPatch -> validate -> approve -> apply` 链路落入版本历史。
- 2026-03-31：本轮 review 发现并修复两处实现风险：
  - `stage-show-01` 仍绑定旧试点社区 slug，真实 public scene catalog 与 T-134 首发社区集不一致。
  - `CommunityGovernanceService.applyAction()` 存在死代码状态默认值，已清理以通过 lint 并保持状态机更清晰。
