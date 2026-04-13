# 02 Architecture — kickoff-data-governance-alignment-temp (T-964)

## Purpose

定义实现包之间的边界、依赖关系、落点习惯与非目标，避免后续实现时再把 kickoff 配置、导入、验证、控制面、治理面重新混在一起。

## Layering

### 1. Declaration Layer

职责：

- 提供 kickoff workflow 的声明层 SSOT
- 绑定 launch contracts、profile、schema、quality、patch-pack registry

主要落点：

- `config/kickoff/manifest.v1.yaml`
- `config/kickoff/contracts/`
- `config/kickoff/profiles/`
- `config/kickoff/quality/`
- `config/kickoff/patch-packs/registry.v1.yaml`

约束：

- 不存 runtime 真值
- 不存一次性 run artifact
- 不覆盖 `config/launch/`

### 2. Control Plane Layer

职责：

- 执行本地 kickoff bootstrap
- 执行 patch dry-run / apply
- 提供 latest run / readiness / import report 摘要

主要落点：

- `src/backend/routes/dev-kickoff.ts`
- `src/backend/services/kickoff-bootstrap-service.ts`
- `src/backend/services/kickoff-patch-import-service.ts`
- `src/backend/services/kickoff-import-report-service.ts`
- `src/backend/services/kickoff-runtime-readiness-service.ts`

约束：

- 只做 orchestration 和 contract handling
- 真实内容写入必须继续走现有 forum/media/warmup service/data-plane

### 3. Runtime State Layer

职责：

- 保存 suite / batch / baseline / content / media 的真实状态
- 计算 activation readiness 与 baseline admission

主要落点：

- 现有数据库表
- `src/backend/services/warmup-governance-service.ts`
- 现有 forum/media services

约束：

- 这是 runtime actual-state SSOT
- patch 不能越过这一层直接改库

### 4. Evidence Layer

职责：

- 保存一次本地 kickoff run 的证据
- 支持 repair loop、回放、比对、调试

主要落点：

- `.ai/.tmp/kickoff-runs/<run-id>/...`
- `src/backend/services/kickoff-run-artifact-service.ts`

约束：

- 不是 SSOT
- 不能反向定义 runtime truth

### 5. Local UX Layer

职责：

- 提供本地入口、状态摘要、debug 视图
- 不取代正式治理面

主要落点：

- `src/frontend/widgets/dev/DevAuthToolbar.tsx`
- `src/frontend/widgets/dev/DevKickoffPanel.tsx`
- `src/frontend/features/admin/pages/admin-panel/WarmupGovernanceTab.tsx`

约束：

- `dev-toolbar` 只做本地控制入口和调试摘要
- admin warmup 继续做 suite-level 治理

## Dependency Graph

- `K1 Declaration Layer`
  - 无前置依赖
- `K2 Local Bootstrap and Dev Control Plane`
  - 依赖 `K1`
- `K3 Patch Import, Import Report, and Runtime Readiness Core`
  - 依赖 `K1`
  - 依赖 `K2`
- `K4 Run Evidence Layer and Patch-Pack Registry Consumption`
  - 依赖 `K1`
  - 依赖 `K3`
- `K5 Dev Toolbar and Local Debug Surface`
  - 依赖 `K2`
  - 依赖 `K3`
  - 依赖 `K4`
- `K6 Governance Safe Editing and Repair Loop`
  - 依赖 `K3`
  - 依赖 `K4`
- `K7 Runtime Simulation and Verification Alignment`
  - 依赖 `K3`
  - 依赖 `K4`
  - 依赖 `K5`

结论：

- 依赖图无环。
- `K1-K4` 是关键主链。
- `K5-K7` 建立在主链之上，不应倒置顺序。

## Interface Contracts

### Bootstrap Result

由 `K2` 提供，供 `K5` 和后续 import/readiness 使用：

- `mode`
- `suite_id`
- `suite_label`
- `kickoff_batch_id`
- `warmup_batch_id`
- `baseline_id`
- `counts`
- `readiness`
- `failed_phase`

### Import Report

由 `K3` 提供，供 `K4/K5/K6` 使用：

- `patch_id`
- `import_run_id`
- `resolved_context`
- `resolution_map`
- `op_results`
- `summary_after_import`
- `readiness_snapshot`
- `recommended_next_actions`

### Runtime Readiness

由 `K3/K7` 提供，供 `K5`、admin 面板、staging verify 使用：

- `baseline_state`
- `layer_readiness`
- `quality_state`
- `admission`
- `summaries`

## Ownership Rules

- `config/kickoff/` 的变更必须先过声明层和 schema 一致性检查。
- dev-only kickoff route 负责本地 orchestration，不应把 admin warmup API 和 dev route 混写到同一职责里。
- 单条内容精修必须挂在 service/API 上，优先复用 `admin-warm-start-routes.ts` 的治理入口，而不是把修补能力塞进 `DevAuthToolbar.tsx`。
- verify 分层输出应先改脚本分组与 contract 来源，再决定是否拆成多个命令。

## Non-goals

- 不在第一批实现里引入独立 kickoff 数据库或独立 schema。
- 不在第一批实现里支持 provider-specific profile。
- 不在第一批实现里要求正式 patch-pack 内容库就位。
- 不在第一批实现里把 dev-toolbar 做成完整治理中心。
