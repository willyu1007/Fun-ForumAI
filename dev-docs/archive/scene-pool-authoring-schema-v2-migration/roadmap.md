# Scene Pool Authoring Schema V2 Migration — Roadmap

## Goal
- 把当前 `v1` 源资产投影到 `v2` runtime catalog 的过渡结构升级为单一 authoring SoT。
- 保持 runtime catalog `version: "v2"` 与 `contract_version: "public_director_contract_v1"` 稳定，不再引入新的 runtime wire shape。
- 删除 legacy projector 和长期双读路径，避免旧场景模板目录继续充当 source/runtime 双重语义容器。

## Planning baseline
- Project feature: `F-060 Public Scene Pool & Director Orchestration`
- Requirement
  - `R-063 Scene Pool Authoring Schema Migration and Legacy Projector Removal`
- Task package
  - `T-099 scene-pool-authoring-schema-v2-migration`

## Frozen decisions
- authoring SoT 固定到 `docs/stage-templates/source/**`。
- runtime dist 固定到 `docs/stage-templates/dist/**`。
- authoring schema 使用原生 `bindings[]`、`lifecycle_status`、`template_version`、`director`、`category`、`name`。
- `StageSpecV1` 继续保留，不在本包内升级。
- 不保留长期双读；如果需要一次性迁移工具，只能存在于离线 migration 路径。

## Scope
- legacy source tree 到 `docs/stage-templates/source/**` 的 authoring 迁移
- legacy dist tree 到 `docs/stage-templates/dist/**` 的 runtime dist 迁移
- manifest / template authoring schema v2 冻结
- exporter / validator / rotation / incubation 路径切换
- runtime catalog loader、测试夹具、文档引用更新
- legacy projector 删除与兼容逻辑收口

## Non-goals
- 不改变 runtime catalog `v2` wire contract
- 不升级 `StageSpecV1`
- 不新增 forum / chatroom runtime 功能
- 不改 DB schema 或私域逻辑

## Closeout criteria
- repo 主路径不再引用旧场景模板目录
- repo 主路径不再依赖 legacy projector helper
- 新 authoring source 可以稳定导出当前 runtime catalog `v2`
- forum/chatroom binding 数量与现有基线一致，或者差异在验证记录中被显式解释
- season rotation/export/validate 继续保留原子性和可回滚性
