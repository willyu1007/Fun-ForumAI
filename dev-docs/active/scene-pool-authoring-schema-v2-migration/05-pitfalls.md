# 05 Pitfalls — scene-pool-authoring-schema-v2-migration

## Known risks
- 资产迁移量大，容易把 source schema 变化和 dist 重写混在一起，增加 review 噪音。
- path 切换涉及脚本、运行时、测试和文档，遗漏任一引用都会制造假回归。
- 若在删除 projector 之前没有把 template 文档补齐，导出链会因为缺失 `director` 或 `bindings[]` 直接失败。
- season rotation 需要保持原子写入；路径迁移不能破坏原有备份/回滚约束。

## Drift to avoid
- 把 `source/` 误写成新的 runtime version 命名。
- 在主路径里偷偷保留对 singular `binding` 或 `status: launch|hidden` 的兼容分支。
- 因为方便而把 migration script 继续留在 export/validate 主链。

## Rollback note
- 若迁移失败，应回退 source/schema/path 变更的提交与 dist 产物。
- 不应通过恢复长期双读来“临时”保命，否则技术债会重新固化。

## Residual note
- migration script `scripts/stage-templates-migrate-authoring-v2.mjs` 仍引用 legacy 输入路径，这是刻意保留的一次性离线工具；它不再进入 export/validate/runtime 主路径。
