# 03 Implementation Notes — scene-pool-authoring-schema-v2-migration

## Primary touchpoints
- `src/backend/stage/stage-template-ops.js`
- `src/backend/stage/public-director-contract.js`
- `src/backend/services/public-scene-catalog-service.ts`
- `src/backend/routes/stage-incubation.ts`
- `scripts/stage-templates-export.mjs`
- `scripts/stage-templates-validate.mjs`
- `scripts/stage-season-rotate.mjs`
- `src/backend/routes/__tests__/stage-template-scripts.test.ts`
- `src/backend/stage/__tests__/public-director-contract.test.ts`
- `src/backend/stage/__tests__/stage-template-ops.test.ts`
- `src/backend/services/__tests__/public-scene-selector-service.test.ts`
- `src/backend/services/__tests__/chatroom-scene-contract-resolver.test.ts`
- 一次性离线 migration tool（已在 T-100 中移除）

## Execution notes
- 先迁 source 资产，再切脚本，再切 runtime loader，最后删 legacy projector。
- path 迁移与 behavior 迁移分步完成，但在主分支最终状态下不保留双读。
- dist 输出路径变化会产生大 diff，应在验证记录中标记为编译产物重写，而不是功能面额外扩张。

## Implemented outcome
- 曾新增一次性 migration script，把旧 `binding/status/director` 资产展开成 authoring v2 source；该工具随后在 `T-100` 中从主仓库移除。
- 已删除 `public-director-contract.js` 中的 legacy source parser/projector，主路径改为直接解析 authoring v2 manifest/template。
- `stage-template-ops`、export/validate/rotation、catalog loader、stage incubation route 与相关 tests 已全部切到 `source/` + `dist/`。
- 旧场景模板目录文件已从仓库删除，避免继续被误当成 SoT。

## Dependency watchlist
- 所有引用旧场景模板目录的脚本、服务、测试、文档。
- 所有引用 legacy projector 或 legacy projector helper 的主路径代码。
- 所有默认假设 manifest 只有单个 `binding` 或 `status: launch|hidden` 的解析逻辑。

## Notes for verification
- `forum` 与 `chat_room` binding 数量需要和 `T-098` 基线对齐。
- validate/export/rotate 的失败信息需要指向新 source 路径，不能继续提示旧 `v1` 目录。
