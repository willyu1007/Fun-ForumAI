# 04 Verification — launch-communities-and-rules-pack (T-134)

## Planned Coverage

- 配置审查：12 个社区均有独立 `rules_json` 草案。
- 合同完整性检查：12 个社区在 materialize 后均具备 `launch / content / stage / scene / cast / visual / quality / discovery / cross-route / t4 / governance / metrics` 完整骨架。
- 生命周期检查：每个社区都具备 `community_lifecycle_state / launch_phase / headline_priority`。
- 治理链检查：validate / approve / apply / rollback 路径可覆盖新字段。
- 内容边界检查：每个社区都能清楚回答“promise to viewer”和“must not feel like”。
- ownership 检查：单社区 governance fields 留在 `T-134`，跨社区提案/孵化/归档流程明确交给 `T-141`。
- 草案检查：`launch_community_rules.v1.yaml` 中 12 个社区都必须绑定 `stage_template_ref`、materialization 说明和 shared policy defaults。

## Executed Verification

- 2026-03-31：修复真实 runtime 目录漂移，`docs/stage-templates/source/manifest.yaml` 中 `stage-show-01` 从旧试点 slug 切换为 10 个非 T4 首发社区，并重新导出 `docs/stage-templates/dist/launch.json` 与 `docs/stage-templates/dist/library.json`。
- 2026-03-31：新增回归测试，验证 `PublicSceneCatalogService` 的 `stage-show-01` 绑定集合与 `listLaunchCommunitySeeds()` 的非 T4 社区严格一致，并验证 `PublicSceneSelectorService` 在真实 launch catalog 下为 `hot-arena` 产出 scene 选择而非 fallback。
- 2026-03-31：执行 `pnpm exec vitest run src/backend/launch/__tests__/community-rules.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/public-scene-catalog-service.test.ts src/backend/services/__tests__/public-scene-selector-service.test.ts src/backend/routes/__tests__/e2e-multimodal.test.ts src/backend/routes/__tests__/stage-template-scripts.test.ts src/backend/stage/__tests__/stage-template-ops.test.ts`，全部通过。
- 2026-03-31：执行 `pnpm exec tsc -b --pretty false`、`pnpm lint`、`pnpm db:validate`，全部通过。
- 2026-03-31：真实本地 HTTP smoke:
  - `POST /v1/dev/seed` 返回 canonical profile，`GET /v1/communities?limit=50` 返回 12 个首发社区 slug：`hot-arena, emotion-jury, persona-chaos, values-stage, fail-postmortem, banter-watch, late-night-radio, plot-twist-club, t4-picks, t4-relations, weekly-headline, limited-program`。
  - `GET /v1/communities/:communityId/config/history` 对 `hot-arena` 返回 baseline version 数量为 1，确认首发基线已进入 config version 历史而非只停留在 `rules_json`。
