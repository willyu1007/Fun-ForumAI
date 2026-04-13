# 03 Implementation Notes — kickoff-data-governance-alignment-temp (T-964)

## 2026-04-13 Planning Phase

- 本阶段未改产品代码，只补齐了 kickoff 临时任务包的规划层文档。
- 已冻结内容：
  - 数据模式与同模式幂等规则
  - kickoff bootstrap contract
  - 本地逻辑隔离与媒体 key 治理
  - local-llm-assisted workflow
  - workflow SSOT 与三层 schema
  - local control/debug 边界
  - verification boundary
  - `config/kickoff/` 第一批落地文件范围
- 本阶段新增内容：
  - `01-plan.md`：实现包拆分与执行顺序
  - `02-architecture.md`：层次边界与依赖关系
  - `04-verification.md`：可执行性、衔接性、覆盖性检查

当前结论：

- 任务包已经具备实现前所需的 planning/architecture/verifiability 基础。
- 下一阶段可以进入代码实现拆分，不需要再回到“需求是否完整”的讨论层。

## 2026-04-13 Implementation Phase

### Landed

- `config/kickoff/` 声明层已落地：
  - `manifest.v1.yaml`
  - `contracts/{authoring-patch,import-report,runtime-readiness}.v1.schema.json`
  - `profiles/{local-llm-assisted-candidate,local-llm-assisted-runtime-simulation}.v1.yaml`
  - `quality/acceptance.v1.yaml`
  - `patch-packs/registry.v1.yaml`
- backend kickoff foundation 已落地：
  - `src/backend/launch/kickoff-workflow.ts`
  - `src/backend/services/kickoff-{bootstrap,patch-import,run-artifact,runtime-readiness,suite-edit}-service.ts`
  - `src/backend/routes/dev-kickoff.ts`
  - `src/backend/validation/kickoff-schemas.ts`
  - `src/shared/kickoff-workflow.ts`
- app/container wiring 已落地：
  - `src/backend/app.ts`
  - `src/backend/container/index.ts`
  - `src/backend/routes/dev-seed.ts`
  - `src/backend/routes/admin/admin-warm-start-routes.ts`
- frontend local control/debug 已落地：
  - `src/frontend/api/hooks/dev.ts`
  - `src/frontend/api/hooks/admin.ts`
  - `src/frontend/api/query-keys.ts`
  - `src/frontend/api/types.ts`
  - `src/frontend/widgets/dev/DevAuthToolbar.tsx`
  - `src/frontend/widgets/dev/DevKickoffPanel.tsx`
  - `src/frontend/features/admin/pages/admin-panel/{WarmupGovernanceTab,use-admin-panel-controller}.ts(x)`
  - `src/frontend/features/admin/pages/AdminPanel.tsx`
- verify grouping 已落地：
  - `scripts/verify-launch-readiness.mjs` 现在按 `Contract / Kickoff Import / Runtime Readiness / Environment/Release` 分组输出

### Behavior Notes

- kickoff 本地主入口已经独立于 `POST /v1/dev/seed`：
  - `POST /v1/dev/kickoff/bootstrap`
  - `POST /v1/dev/kickoff/imports`
  - `GET /v1/dev/kickoff/status`
  - `GET /v1/dev/kickoff/runs/latest`
  - `GET /v1/dev/kickoff/runs/:runId`
- `DevAuthToolbar` 已明确分成四个动作：
  - `加载 Mock`
  - `加载 Smoke`
  - `Kickoff Candidate`
  - `Kickoff Active`
- `WarmupGovernanceTab` 已增加最小精修入口：
  - `rewrite_post`
  - `replace_post_media`
  - `regenerate_thread`
  - `regenerate_turn`
- `dry_run` 导入现在会保留逻辑键 resolution，不会在存在依赖链时提前失真。

### Remaining Constraint

- 全仓 `pnpm typecheck` 仍失败，但当前剩余失败项均来自 repo 既有问题，不再包含 kickoff 本轮新增文件：
  - `src/backend/runtime/__tests__/forum-roaming.test.ts`
  - `src/backend/runtime/forum-roaming.ts`
  - `src/backend/services/__tests__/recall-state-store.test.ts`
  - `src/backend/services/forum-read-service.ts`
  - `src/backend/services/search/thread-search-provider.ts`

## 2026-04-13 Review and Cleanup Phase

### Findings Addressed

- `Mock/Smoke` 本地切换原先只调用 `POST /v1/dev/seed`，不会先 reset，和“跨模式切换必须 reset + load”的合同冲突；现已把 dev-toolbar 的 seed 动作改成显式传递 `reset_before_seed=true`，并让 `dev-seed` route 在本地安全前提下执行 `migrate reset + db:generate + runDevSeed(profile)`。
- kickoff import 之前允许 `profile_id` 与 `patch.patch_meta.patch_kind` / `patch.target.mode` 不一致，存在 profile 解释漂移风险；现已在 import service 中显式阻断。
- kickoff bootstrap 之前允许 `input.mode` 与 profile 声明 mode 不一致；现已在 bootstrap service 中显式阻断。
- `regenerate_thread` 之前刷新的是已删除的旧 thread id，而不是新建 thread id；现已改为刷新新 thread，并对缺失 `actor_agent_id` 的重建动作 fail-closed。
- kickoff workflow loader 测试原先会在 `.ai/.tmp/` 留下临时 manifest 目录；现已让测试自清理，并删除了本地残留的 `kickoff-workflow-test-*` 目录。

### Cleanup Notes

- 本轮检查后，没有保留任何额外的 tracked 废弃文件；`config/kickoff/`、dev kickoff routes/services、frontend debug/control surface、以及新增测试都仍然属于当前有效实现。
- 已删除本轮测试在 `.ai/.tmp/` 下遗留的 kickoff 临时目录，避免后续本地调试和真实 kickoff run 混淆。
