# 01 Plan — kickoff-data-governance-alignment-temp (T-964)

## Objective

把当前已经冻结的 kickoff 结论拆成一组可执行、可串联、可验收的实现包，使本地能够产出高质量、可用、可观测、可修补的 kickoff 数据。

## Delivery Strategy

本次实现拆分按三段推进：

1. `foundation`
   - 先把 `config/kickoff/`、声明合同、bootstrap/control plane、patch/import/readiness 主链打通。
2. `local operability`
   - 再补本地 control surface、debug evidence、run artifact 导航。
3. `full workflow`
   - 最后补安全微调、repair loop、runtime simulation 与分层 verify 对齐。

只有三段全部完成，才满足当前任务包里定义的完整 kickoff 目标。

## Implementation Packages

### K1. Kickoff Declaration Layer

目标：

- 落地 `config/kickoff/` 第一批文件。
- 提供 kickoff workflow 的可发现入口、schema refs、profile refs、quality refs、patch-pack registry refs。

建议落点：

- `config/kickoff/manifest.v1.yaml`
- `config/kickoff/contracts/*.schema.json`
- `config/kickoff/profiles/*.yaml`
- `config/kickoff/quality/acceptance.v1.yaml`
- `config/kickoff/patch-packs/registry.v1.yaml`
- `src/backend/launch/` 下新增 kickoff manifest/profile loader 与校验测试

产出：

- kickoff workflow manifest
- 三层 schema 文件
- 两个 local-llm-assisted profile
- acceptance quality profile
- patch-pack registry
- 后端 loader / validator

依赖：

- 无

验证门：

- manifest 可解析
- schema refs / profile refs / quality refs / registry refs 全部可解析
- 与 `config/launch/manifest.v1.yaml` 的引用关系清晰且无循环

### K2. Local Bootstrap and Dev Control Plane

目标：

- 把 `candidate` / `active` bootstrap 收口成单入口后端控制面。
- 保留 `dev/seed` 现有职责，把 kickoff 链路单独挂到新的 dev-only kickoff route/service 上。

建议落点：

- `src/backend/services/kickoff-bootstrap-service.ts`
- `src/backend/routes/dev-kickoff.ts`
- `src/backend/routes/index.ts`
- `src/backend/dev/` 下新增本地 kickoff CLI 包装

产出：

- `bootstrap candidate`
- `bootstrap active`
- 统一 bootstrap result
- reset / migrate / launch seed / suite create / optional activate 编排

依赖：

- `K1`

验证门：

- 干净本地库可进入 `Kickoff Candidate`
- 干净本地库可进入 `Kickoff Active`
- 结构层缺失时 fail-closed
- 输出合同包含 `mode/suite/batch/baseline/readiness/failed_phase`

### K3. Patch Import, Import Report, and Runtime Readiness Core

目标：

- 接收 external assistant 产出的 `authoring patch`
- 通过真实 service/data-plane 完成导入
- 产出 `import report` 与 `runtime readiness snapshot`

建议落点：

- `src/backend/services/kickoff-patch-import-service.ts`
- `src/backend/services/kickoff-import-report-service.ts`
- `src/backend/services/kickoff-runtime-readiness-service.ts`
- `src/backend/routes/dev-kickoff.ts`
- 必要时扩展 `src/backend/services/warmup-governance-service.ts`

产出：

- patch dry-run / apply
- logical-key resolution
- import report
- readiness snapshot
- unresolved refs / partial failure 表达能力

依赖：

- `K1`
- `K2`

验证门：

- authoring patch 可被 schema 校验
- dry-run 与 apply 行为一致
- apply 后真实生成 suite/batch/post/thread/turn/media
- 每次 apply 都产出 import report 与 readiness snapshot

### K4. Run Evidence Layer and Patch-Pack Registry Consumption

目标：

- 将本地 kickoff 运行证据落到 `.ai/.tmp/kickoff-runs/<run-id>/`
- 让 patch-pack registry 真正进入工作流，而不只是静态占位

建议落点：

- `.ai/.tmp/kickoff-runs/<run-id>/...`
- `config/kickoff/patch-packs/registry.v1.yaml`
- `src/backend/services/kickoff-run-artifact-service.ts`
- `src/backend/routes/dev-kickoff.ts`

产出：

- `context-pack.json`
- `generated-patch.yaml`
- `import-report.json`
- `readiness-snapshot.json`
- `diff-summary.md`
- `repair-patch.yaml`
- `failure-log.json`

依赖：

- `K1`
- `K3`

验证门：

- 每次 kickoff run 都生成稳定的 run id 和 artifact 目录
- import report / readiness snapshot / failure log 能被 run artifact 索引到
- patch-pack registry 可作为后续复用入口被发现

### K5. Dev Toolbar and Local Debug Surface

目标：

- 把 kickoff 本地操作入口和调试摘要补到 `dev-toolbar`
- 维持 admin warmup 作为 suite-level 治理主面

建议落点：

- `src/frontend/widgets/dev/DevAuthToolbar.tsx`
- `src/frontend/widgets/dev/DevKickoffPanel.tsx`
- `src/frontend/widgets/dev/__tests__/...`
- 前端 API 调用层与必要 DTO

产出：

- `load mock`
- `load smoke`
- `bootstrap kickoff candidate`
- `bootstrap kickoff active`
- latest run / suite / baseline / readiness summary
- 跳转 admin warmup / 打开 latest report

依赖：

- `K2`
- `K3`
- `K4`

验证门：

- 本地用户无需命令行即可完成主要 kickoff 操作
- toolbar 不复制 admin warmup 治理逻辑
- debug 摘要只消费 import/readiness 两层，不混入完整 release verification

### K6. Governance Safe Editing and Repair Loop

目标：

- 把单条 kickoff 内容微调变成正式 service/API 能力
- 与 repair loop 闭环连接，而不是回退到直接改 DB

建议落点：

- `src/backend/services/kickoff-edit-service.ts`
- `src/backend/routes/admin/admin-warm-start-routes.ts`
- `src/frontend/features/admin/pages/admin-panel/WarmupGovernanceTab.tsx`

产出：

- 替换单帖图片
- 改写标题/正文
- 删除并重建 reply / turn
- 指定 post/thread 局部重生成
- repair patch apply 入口

依赖：

- `K3`
- `K4`

验证门：

- 所有精修动作都通过 service/API 完成
- 精修后 lineage / projection / suite stats / readiness 会刷新
- 不需要直接改数据库 key 或手工 SQL

### K7. Runtime Simulation and Verification Alignment

目标：

- 完成 `local-llm-assisted-runtime-simulation`
- 把本地验证、staging 放行、环境发布检查的边界真正落到代码/脚本输出上

建议落点：

- `src/backend/services/kickoff-runtime-simulation-service.ts`
- `src/backend/routes/dev-kickoff.ts`
- `scripts/verify-launch-readiness.mjs`
- 必要时扩展 admin/runtime stats 输出

产出：

- runtime instruction import / simulation
- 按四层分组的 verify 输出
- 本地与 staging 共用的 runtime readiness 合同

依赖：

- `K3`
- `K4`
- `K5`

验证门：

- 不配置本地 provider 也可跑 runtime-simulation
- staging verify 继续消费同一套 readiness 字段
- verify 输出按四层分组，不再混成单一 verdict

## Recommended Execution Order

1. `K1`
2. `K2`
3. `K3`
4. `K4`
5. `K5`
6. `K6`
7. `K7`

说明：

- `K1-K4` 组成“可产出 candidate kickoff 数据”的最小闭环。
- `K5` 补齐本地可操作性与高频调试。
- `K6-K7` 补齐完整治理、repair loop、runtime simulation 与 verify 对齐。

## Minimum Shippable Slice

若必须先交一版“可用但未完全补齐”的 kickoff，本包建议最小交付切片为：

1. `K1`
2. `K2`
3. `K3`
4. `K4`
5. `K5`

这五包完成后，已经可以满足：

- 本地 kickoff candidate 生成
- 真实导入
- import report / readiness 输出
- run artifact 保留
- dev-toolbar 快速操作与摘要查看

但仍不满足：

- 单条内容安全微调
- repair loop 正式化
- runtime simulation 完整闭环

## Package-Level Acceptance

- 每个实现包必须有单独验证门，不能只依赖最终手工串测。
- `K1-K4` 完成后必须能独立演示“从干净库到 candidate suite + report/readiness”。
- `K5` 完成后必须能独立演示“无需命令行即可完成主要本地 kickoff 操作”。
- `K6-K7` 完成后才可以宣称“完整 kickoff 链路完成”。
