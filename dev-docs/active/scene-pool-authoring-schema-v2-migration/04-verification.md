# 04 Verification — scene-pool-authoring-schema-v2-migration

## Required commands
- `pnpm exec tsc -p tsconfig.json --noEmit`
- `node scripts/stage-templates-export.mjs`
- `node scripts/stage-templates-validate.mjs`
- `node scripts/stage-season-rotate.mjs --dry-run`
- `pnpm vitest run src/backend/stage/__tests__/public-director-contract.test.ts`
- `pnpm vitest run src/backend/stage/__tests__/stage-template-ops.test.ts`
- `pnpm vitest run src/backend/routes/__tests__/stage-template-scripts.test.ts`
- `pnpm vitest run src/backend/services/__tests__/public-scene-selector-service.test.ts`
- `pnpm vitest run src/backend/services/__tests__/chatroom-scene-contract-resolver.test.ts`

## Expected outcomes
- typecheck 通过
- export/validate/rotate 全部以 `docs/stage-templates/source` 为输入、`docs/stage-templates/dist` 为输出
- `launch.json` 仍可被 `PublicSceneCatalogService` 正常加载
- forum/chatroom binding 数量与 `T-098` 基线一致，或差异被明确记录
- repo 主路径不再存在旧场景模板目录与 legacy projector 依赖

## Evidence to capture
- 关键命令输出摘要
- dist 产物路径切换后的文件列表
- binding 计数与 template 计数
- 删除 legacy projector 后的引用清零证明

## Result
- `2026-03-14` 已执行：
  - `pnpm exec tsc -p tsconfig.json --noEmit`
  - `node scripts/stage-templates-export.mjs`
  - `node scripts/stage-templates-validate.mjs`
  - `node scripts/stage-season-rotate.mjs --dry-run`
  - `pnpm vitest run src/backend/stage/__tests__/public-director-contract.test.ts src/backend/stage/__tests__/stage-template-ops.test.ts src/backend/routes/__tests__/stage-template-scripts.test.ts src/backend/services/__tests__/public-scene-selector-service.test.ts src/backend/services/__tests__/chatroom-scene-contract-resolver.test.ts`
  - `pnpm vitest run src/backend/services/__tests__/forum-scene-continuity-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/runtime-scene-state-manager.test.ts src/backend/services/__tests__/chatroom-local-intent-service.test.ts src/backend/services/__tests__/room-program-projector.test.ts src/backend/runtime/__tests__/post-scheduler.test.ts`
- 结果：
  - 全部通过；
  - `docs/stage-templates/dist/launch.json` 可正常导出并被 runtime consumer 读取；
  - 当前导出基线为 `templates=50`、`launch=20`、`hidden=30`；
  - `--dry-run` season rotation 返回 `replaced=3`、`activated=3`，证明 rotation 仍可在不写入情况下完成验证。
