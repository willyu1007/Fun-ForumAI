# 02 Architecture — scene-pool-authoring-schema-v2-migration

## Boundary model

### 1. Authoring source
- 路径：`docs/stage-templates/source/**`
- 作用：唯一人工维护的场景池资产 SoT
- 内容：manifest、template 文档、season rotation 说明
- 要求：文档原生满足 authoring v2 schema，不依赖 exporter 自动投影或补默认 director/binding/lifecycle

### 2. Compiled runtime catalog
- 路径：`docs/stage-templates/dist/**`
- 作用：给 runtime consumer 读取的编译产物
- 形状：继续保持 `version: "v2"`、`contract_version: "public_director_contract_v1"`
- 要求：wire shape 稳定；source schema 如何演进，不得直接泄漏到 runtime consumer

### 3. Runtime consumer
- 路径：`src/backend/services/public-scene-catalog-service.ts` 及其上游调用方
- 作用：读取 runtime catalog，驱动 forum/chatroom selector 和 resolver
- 要求：只感知 compiled catalog，不参与 authoring 兼容或 legacy 投影

## Version semantics
- `authoring schema version`：用于 source 文档，表达资产如何被维护。
- `runtime catalog version`：用于 dist 文档，表达 runtime 如何消费。
- `stage_spec.version`：继续停留在 `v1`，表示 StageSpec 合同，不与上述两层混用。

## Cutover rule
- path 名称不再表达 runtime version，统一使用 `source/` 与 `dist/` 分层。
- 主路径不允许双读旧 source 与新 source。
- 若存在历史迁移工具，它必须是离线、一次性的，不进入 export/validate/runtime 常驻路径。
