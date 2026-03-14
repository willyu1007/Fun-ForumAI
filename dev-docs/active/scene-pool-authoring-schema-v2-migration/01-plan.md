# 01 Plan — scene-pool-authoring-schema-v2-migration

## Phase 0 — Schema freeze
- 明确 authoring v2 manifest 与 template 的必填字段和默认值策略。
- 明确哪些字段留在 authoring 层，哪些字段只存在 runtime catalog 层。
- 锁定“不保留长期双读”的 cutover 原则。

## Phase 1 — Source layout migration
- 新建 `docs/stage-templates/source/manifest.yaml` 与 `docs/stage-templates/source/templates/*.yaml`。
- 把现有 `v1` assets 迁到 source 路径，并将 manifest 统一成 `bindings[] + lifecycle_status`。
- 把 template 文档补齐 `template_version`、`director`、`category`、`name`。

## Phase 2 — Toolchain migration
- 更新 export / validate / season rotation / incubation 入口，全部只读新 source 路径。
- dist 统一输出到 `docs/stage-templates/dist/**`。
- 增加一次性 migration 工具，负责把旧 authoring 资产升级到新 schema。

## Phase 3 — Runtime and tests cutover
- 更新 runtime catalog loader、测试夹具与验证脚本的路径引用。
- 确保 `PublicSceneCatalogService` 继续消费既有 `v2` wire shape，不感知 source schema 迁移。
- 让 repo 内引用不再依赖旧场景模板目录。

## Phase 4 — Legacy cleanup
- 删除 legacy projector helper 以及相关主路径兼容逻辑。
- 删除 repo 主路径对 singular `binding`、`status -> lifecycle_status` 投影和 director 自动补齐的依赖。
- 保留的迁移脚本只能作为一次性离线工具，不允许继续被 export/validate/runtime 主链调用。

## Phase 5 — Verification and rollback
- 运行 typecheck、导出/校验/轮换脚本和相关 tests。
- 对比 forum/chatroom binding 基线，记录任何差异。
- 明确 rollback 手段：回退 source 迁移提交与 dist 产物，而不是恢复长期双读。
