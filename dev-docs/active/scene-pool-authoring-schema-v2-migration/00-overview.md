# 00 Overview — scene-pool-authoring-schema-v2-migration (T-099)

## Status
- State: done
- Next step: 无 task-local 后续动作；source/dist cutover、legacy projector 删除与验证已完成。

## Goal
把当前“`v1` 源资产 -> `v2` runtime catalog”的过渡结构收敛成：
- 单一 authoring source of truth；
- 单一 runtime catalog 输出；
- 无长期 legacy projector、无路径级版本歧义。

## Non-goals
- 不更改 `PublicSceneCatalogService` 消费的 runtime wire shape。
- 不在本包内重新设计 `StageSpecV1`。
- 不扩展新的 director runtime 功能或 UI。
- 不保留长期双读；若需要迁移脚本，仅允许一次性离线使用。

## Context
- `T-094 ~ T-098` 已把 public scene pool、selector、chatroom runtime 和验证链打通，但为了快速闭环，引入了 `v1 source -> v2 dist` 的兼容结构。
- 旧场景模板目录曾同时承担 source 路径、runtime dist 路径和“旧 authoring schema”语义，版本名已经失真。
- legacy projector helper 曾挂在主导出/校验路径上，意味着 repo 主路径会自动修补 `director`、`binding`、`lifecycle_status`。
- 如果不做这次迁移，后续每次扩展 scene pool 资产都要继续背负 legacy 兼容债和路径歧义。

## Acceptance criteria (high level)
- [x] `docs/stage-templates/source/manifest.yaml` 成为唯一 authoring 入口，`templates/*.yaml` 原生满足 authoring v2 schema。
- [x] `docs/stage-templates/dist/library.json` 与 `docs/stage-templates/dist/launch.json` 成为唯一 runtime dist 产物。
- [x] exporter / validator / rotation / incubation / catalog loader / 测试夹具全部切到新路径。
- [x] repo 主代码不再出现 legacy projector helper 或 legacy projector 主路径语义。
- [x] 运行时仍能稳定消费 `version: "v2"`、`contract_version: "public_director_contract_v1"` 的 catalog。
- [x] 迁移差异、回滚策略和剩余风险被记录进 task bundle，而不是留在口头共识。
