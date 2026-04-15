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

## 2026-04-14 Content Redesign Planning Phase

- 用户明确指出当前 kickoff 虽然链路可用，但内容与图片仍表现为“重复、像原来就有、没有营养和深度”，不满足“一人分饰多角色”的导演式 kickoff 目标。
- 复盘后确认该判断成立：
  - 文本主源仍是 `src/backend/launch/launch-warm-start.ts` 中的静态 `CURATED_LAUNCH_WARM_START_POSTS`
  - 图片仍由 `WarmupGovernanceService` 从固定 `LOCAL_WARMUP_MEDIA_ASSETS` 池中按社区 hash 选取
  - 这套实现完成了 operator/integrator/debugger 责任，但没有完成真正的 `showrunner / writer room / visual director` 责任
- 为避免旧 kickoff 信息继续污染评估，本阶段先执行了彻底清理：
  - 停掉本地 backend
  - 删除 `.ai/.tmp/kickoff-runs/`
  - destructive reset 本地数据库
  - 回到干净 `canonical` 基线
- 本阶段新增内容：
  - `06-content-redesign.md`：新的 kickoff 内容蓝图，明确导演主线、writer room 节奏、视觉 shot list、质量门、以及后续实现落点

## 2026-04-14 Bootstrap Concurrency Hardening

- 用户重新触发 `Kickoff Active` 时，调控台再次显示 `media_assets_steward_agent_id_fkey` 失败。
- 复盘发现，这类失败不只是媒体写入单点问题，还可能来自 **bootstrap 期间有别的 dev data 操作把数据库切走**。
- 本次定位拿到了明确证据：
  - 一次失败 run 的时间窗内，服务端同时出现了 `POST /v1/dev/seed 200`
  - 这会把 bootstrap 刚 reset + launch seed 的状态改回别的 data mode，最终让 `create_suite` 在媒体写入阶段拿到失效的 steward agent id
- 本轮因此补了共享保护，而不是继续只盯 Prisma/FK 表面症状：
  - 新增 `DevDataOperationLock`，统一锁住 `dev/seed` 与 `dev/kickoff/bootstrap`
  - `DevAuthToolbar` 在 `seed` / `kickoff bootstrap` mutation pending 时禁用 destructive 动作
- 这次改动的目标是把本地 kickoff / seed 操作收敛到同一条 destructive lane，避免跨入口互踩。

## 2026-04-14 Narrative Kickoff Completion

- 本轮先完成了三件内容层重构：
  - 重新生成 `public/kickoff-boards/` 下的 6 张逐帖视觉板，不再复用社区 banner
  - 重写 `src/backend/launch/launch-warm-start.ts` 中的 14 条 kickoff/warmup 内容，主线统一为《零点彩排》直播失控后的责任与关系争夺
  - 让 `WarmupGovernanceService` 优先消费 `visual_asset_path`，真正按帖子绑定本地视觉资产
- 在真实重跑中，先后暴露出两类“内容已改但治理仍不通过”的问题：
  - 文本里出现 `事故` 等词时，会被 hot-topic policy 误判到敏感面，导致 bootstrap fail-closed
  - afternoon handoff 的两条内容虽然在文案语义上承担 continuity 责任，但运行态 `launch-programming-ops` 只认 `content_semantics.narrative.storyline_state` / `distribution.content_kind`，不认标签
- 因此本轮没有继续用“堆标签”修补，而是补了一条更稳定的语义链：
  - `launch-warm-start.ts` 的 `storyline` 现在允许显式 `state`
  - `programming-projection.ts` 现在优先尊重 `launch_programming.storyline.state`
  - `persona-chaos` 与 `creator-relationship` 两条下午串线内容显式标为 `callback`
- 这条修复的目的很明确：
  - 保持 `creator-relationship` 仍然是 creator-note 展示形态
  - 同时让 runtime programming health 正确把它们记作 continuity supply
  - 避免把 note-entry / story-episode 粗暴改写成 `continuity_callback` 造成表面通过、展示语义受损
