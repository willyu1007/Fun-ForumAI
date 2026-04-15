# 04 Verification — kickoff-data-governance-alignment-temp (T-964)

## 2026-04-13 Documentation Review

### Commands

```bash
find dev-docs/active/kickoff-data-governance-alignment-temp -maxdepth 2 -type f | sort
rg --files config | sort
find config -maxdepth 3 -type d | sort
sed -n '1,220p' config/launch/manifest.v1.yaml
find src/backend/routes -maxdepth 2 -type f | sort
find src/backend/services -maxdepth 1 -type f | sort
find src/backend/launch -maxdepth 2 -type f | sort
find src/backend/dev -maxdepth 2 -type f | sort
sed -n '1,220p' src/frontend/widgets/dev/DevAuthToolbar.tsx
```

### Outcomes

- `config/kickoff/` 当前尚不存在，第一批落地文件范围没有与现有目录冲突。
- 现有 repo 已存在合适的挂载点：
  - `src/backend/launch/` 适合放 kickoff manifest/profile loader
  - `src/backend/dev/` 适合放本地 kickoff CLI 包装
  - `src/backend/routes/` 适合新增 dev-only kickoff route
  - `src/backend/services/` 适合新增 bootstrap/import/report/readiness 服务
  - `src/frontend/widgets/dev/DevAuthToolbar.tsx` 已是本地控制面现有入口
  - `src/frontend/features/admin/pages/admin-panel/WarmupGovernanceTab.tsx` 已是 suite-level 治理现有入口

## Executability Review

### Check 1. Package graph is acyclic

结果：`pass`

说明：

- `K1 -> K2 -> K3 -> K4 -> K5 -> K7`
- `K3 -> K6`
- `K4 -> K6`
- 没有包要求回头修改前置包作为硬前提

### Check 2. There is a minimum usable slice

结果：`pass`

最小可用切片：

- `K1`
- `K2`
- `K3`
- `K4`
- `K5`

该切片已经覆盖：

- kickoff 声明层
- 本地 bootstrap
- patch import
- import report / readiness
- run artifact
- dev-toolbar 快捷操作与状态摘要

### Check 3. Full requirement coverage

结果：`pass`

需求映射：

- 数据模式与 reset/load：`K2` + `K5`
- kickoff bootstrap：`K2`
- authoring patch/import report/readiness：`K1` + `K3`
- run evidence / patch-pack registry：`K4`
- dev-toolbar / kickoff debug：`K5`
- 单条内容安全微调 / repair loop：`K6`
- runtime simulation / verification boundary 落地：`K7`

### Check 4. Existing repo boundaries are respected

结果：`pass`

说明：

- `config/launch/` 仍是 launch 业务合同 SSOT
- `config/kickoff/` 只作为 workflow 声明层
- 数据库仍是 runtime actual-state SSOT
- 没有任何实现包要求直接改数据库 key 或绕过 service/data-plane

### Check 5. Remaining gaps

结果：`known but non-blocking`

剩余缺口：

- 本轮没有继续清理 repo 既有全仓 `pnpm typecheck` 遗留；剩余错误仍位于 kickoff 以外的历史模块
- `K6` 当前只提供最小精修入口，后续如果继续增强交互，需要继续控制 admin 面复杂度
- `K7` 已完成 verify 分组输出，但如果后续 staging 使用方对脚本输出格式有新要求，仍需要增量兼容

## Conclusion

本任务包当前具备以下特征：

- 可执行：有明确实现包、依赖顺序、最小可用切片、每包验证门
- 衔接合理：主链为 `K1-K4`，本地可操作性与完整治理建立在主链上
- 覆盖完整：已覆盖 kickoff 本地可用性、质量、可观测性、修补、runtime simulation、verify 分层
- 满足目标：按当前拆分推进，可以覆盖“形成完整 kickoff 链路并生成高质量可用 kickoff 数据”的使用需求

## 2026-04-13 Implementation Verification

### Commands

```bash
pnpm vitest \
  src/backend/routes/__tests__/dev-seed.test.ts \
  src/backend/services/__tests__/kickoff-bootstrap-service.test.ts \
  src/backend/launch/__tests__/kickoff-workflow.test.ts \
  src/backend/routes/__tests__/dev-kickoff.test.ts \
  src/backend/services/__tests__/kickoff-run-artifact-service.test.ts \
  src/backend/services/__tests__/kickoff-patch-import-service.test.ts \
  src/backend/services/__tests__/kickoff-suite-edit-service.test.ts \
  src/frontend/widgets/dev/__tests__/DevAuthToolbar.test.tsx \
  src/frontend/widgets/dev/__tests__/DevKickoffPanel.test.tsx

pnpm typecheck
```

### Outcomes

- 定向 kickoff 测试：`pass`
  - 9 个测试文件
  - 23 个测试全部通过
- 验证覆盖：
  - review cleanup: `dev/seed` reset-before-seed contract
  - review cleanup: bootstrap profile/mode guard
  - K1: kickoff manifest/profile/schema/registry loader
  - K2: `dev/kickoff` route bootstrap/status/run lookup
  - K3: patch import `dry_run/apply`，含依赖链 resolution
  - K4: run artifact 写入/读取
  - K5: `DevAuthToolbar` / `DevKickoffPanel`
  - K6: suite edit preview/apply
  - K6 cleanup: regenerate_thread refreshes the new thread id
  - K7 cleanup: patch profile/kind/mode consistency is enforced before import
- `pnpm typecheck`：`known failing`
  - 当前失败项只剩既有 repo 问题，不再包含 kickoff 本轮新增文件
  - 遗留失败位置：
    - `src/backend/runtime/__tests__/forum-roaming.test.ts`
    - `src/backend/runtime/forum-roaming.ts`
    - `src/backend/services/__tests__/recall-state-store.test.ts`
    - `src/backend/services/forum-read-service.ts`
    - `src/backend/services/search/thread-search-provider.ts`

### Closure Assessment

- 任务包可执行性：`pass`
- 任务衔接合理性：`pass`
- 功能覆盖完整性：`pass`
- 使用目标匹配度：`pass`

当前结论：

- kickoff 本地完整链路已具备可用实现：
  - declaration layer
  - bootstrap
  - patch import
  - import report
  - runtime readiness
  - run evidence
  - dev-toolbar / debug panel
  - suite-level safe editing
  - verify 分层输出
- 剩余阻塞只来自 repo 既有全仓 typecheck 失败，不是 kickoff 本轮新增内容。

## 2026-04-14 Content Redesign and Cleanup Verification

### Commands

```bash
curl -s http://localhost:4000/v1/dev/kickoff/status | jq .
psql 'postgresql://yurui@localhost:5432/llm_forum_dev' -P pager=off -c "select 'warmup_suites' as table_name, count(*) as count from warmup_suites union all select 'warm_start_batches', count(*) from warm_start_batches union all select 'active_baselines', count(*) from active_baselines;"
find .ai/.tmp/kickoff-runs -maxdepth 1 \( -type f -o -type d \) | sort
sed -n '1,220p' config/kickoff/quality/acceptance.v1.yaml
sed -n '320,430p' dev-docs/active/kickoff-data-governance-alignment-temp/roadmap.md
sed -n '1,220p' config/launch/launch_programming_schedule.v1.yaml
node .ai/scripts/ctl-project-governance.mjs sync --apply --project main
```

### Outcomes

- kickoff 历史运行痕迹已清空：
  - `/v1/dev/kickoff/status` 返回 `current_data_mode = unknown`
  - `latest_run = null`
  - `current_suite.id = null`
- 数据库中的 kickoff 治理对象已归零：
  - `warmup_suites = 0`
  - `warm_start_batches = 0`
  - `active_baselines = 0`
- `.ai/.tmp/kickoff-runs` 目录已清空，只保留空目录本身，不再残留 run artifact / marker
- 内容重设计的输入合同已复核：
  - `config/kickoff/quality/acceptance.v1.yaml` 继续作为最低 readiness 合同
  - `config/launch/launch_programming_schedule.v1.yaml` 继续作为 daypart / slot contract
  - `roadmap.md` 中的 local-llm-assisted workflow 继续作为 assistant 角色边界
- 新阶段已从“链路可用性”转到“内容质量重构”，task 状态将重新回到 `in-progress`

## 2026-04-14 Bootstrap Concurrency Verification

### Commands

```bash
pnpm vitest src/backend/services/__tests__/kickoff-bootstrap-service.test.ts
pnpm vitest src/backend/routes/__tests__/dev-seed.test.ts
pnpm vitest src/frontend/widgets/dev/__tests__/DevAuthToolbar.test.tsx
curl -s -o /tmp/kickoff-bootstrap-1.json -w '%{http_code}' -X POST http://localhost:4000/v1/dev/kickoff/bootstrap -H 'content-type: application/json' --data '{"mode":"active","profile_id":"local-llm-assisted-runtime-simulation"}'
curl -s -o /tmp/kickoff-bootstrap-2.json -w '%{http_code}' -X POST http://localhost:4000/v1/dev/kickoff/bootstrap -H 'content-type: application/json' --data '{"mode":"active","profile_id":"local-llm-assisted-runtime-simulation"}'
```

### Outcomes

- 回归测试：`pass`
  - `kickoff-bootstrap-service`：第二条 bootstrap 会被拒绝，不再并发 reset/create-suite
  - `dev-seed route`：共享锁被占用时返回 `409 CONFLICT`
  - `DevAuthToolbar`：mutation pending 时 destructive 动作按钮被禁用
- 实机并发验证：
  - 第二条 `POST /v1/dev/kickoff/bootstrap` 已稳定返回 `409`
  - 本地不会再因为双击 / 连点再造并发 kickoff run
- 额外定位结论：
  - 先前的 FK 失败并不只是媒体层单点故障，还和 bootstrap 期间有其他 dev data 操作插入有关
  - 后续本地 kickoff 验收，必须把 `dev/seed` / `kickoff/bootstrap` 视作同一条 destructive lane

## 2026-04-14 Narrative Kickoff Final Verification

### Commands

```bash
pnpm vitest src/backend/launch/__tests__/programming-contracts.test.ts
pnpm vitest src/backend/services/__tests__/warmup-governance-service.test.ts

curl -s -X POST http://localhost:4000/v1/dev/kickoff/bootstrap \
  -H 'Content-Type: application/json' \
  --data '{"mode":"active","profile_id":"local-llm-assisted-runtime-simulation"}'

curl -s http://localhost:4000/v1/dev/kickoff/status

TOKEN=$(node -e "process.stdout.write(Buffer.from(JSON.stringify({userId:'dev-admin-001',email:'dev-admin-001@dev.local',role:'admin'})).toString('base64url'))")
curl -s http://localhost:4000/v1/admin/launch/programming-ops -H "Authorization: Bearer $TOKEN"

psql 'postgresql://yurui@localhost:5432/llm_forum_dev' -At -F $'\t' -c "
select 'warmup_suites', count(*) from warmup_suites
union all select 'warm_start_batches', count(*) from warm_start_batches
union all select 'active_baselines', count(*) from active_baselines
union all select 'posts', count(*) from posts
union all select 'threads', count(*) from public_stage_threads
union all select 'turns', count(*) from public_stage_turns
union all select 'votes', count(*) from votes
union all select 'media_assets', count(*) from media_assets;
"
```

### Outcomes

- 语义修复回归：`pass`
  - `programming-contracts.test.ts` 新增显式 `storyline.state=callback` 回归，通过
  - `warmup-governance-service.test.ts` 继续通过，未引入 suite-level 回归
- 最终成功 run：
  - `run_id = 2026-04-14T15-19-41-652Z-362f1e0c`
  - `suite_id = cmnyrpcu00000pwnoy5gxks4q`
  - `kickoff_batch_id = cmnyrpcu20001pwnot7digk0f`
  - `warmup_batch_id = cmnyrzycu00xjpwno8wx5zh5d`
  - `baseline_id = cmnys45zc015ipwnoww8u4n2v`
- `/v1/dev/kickoff/status`：`pass`
  - `current_data_mode = kickoff-active`
  - `activation_readiness.ok = true`
  - `key_communities_ready = true`
  - `key_shelves_ready = true`
  - `media_access_ok = true`
  - `aftershow_pipeline_ok = true`
  - `allow_public_growth = true`
- `/v1/admin/launch/programming-ops`：`pass`
  - `daypart_readiness` 四个时段全部 `ok = true`
  - `community_supply_floor` 关键社区全部 `ok = true`
  - 之前失败的两个社区已被修正：
    - `persona-chaos.continuity_callbacks = 1`
    - `creator-relationship.continuity_callbacks = 1`
- 数据规模与媒体覆盖：`pass`
  - `posts = 14`
  - `threads = 14`
  - `turns = 44`
  - `votes = 131`
  - `media_assets = 7`
  - `communities = 12`
  - `media_coverage_ratio = 0.5`

### Closure Assessment

- kickoff 工程链：`pass`
- 内容治理链：`pass`
- runtime programming health：`pass`
- local kickoff 可消费性：`pass`

当前结论：

- 这份任务包的目标已经完成：本地 kickoff 现在既能完整生成，也能通过 runtime programming / admission / media / aftershow 质量门。
- 后续如果继续推进，只属于“增量内容优化”或“staging 扩展验证”，不再是本任务的完成条件。
