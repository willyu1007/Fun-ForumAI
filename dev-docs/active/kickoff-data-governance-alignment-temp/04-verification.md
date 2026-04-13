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
