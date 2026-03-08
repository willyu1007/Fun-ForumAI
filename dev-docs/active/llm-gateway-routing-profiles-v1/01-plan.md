# 01 Plan — T-064

## Phase 0 Gateway Envelope
1. 定义 request/response、execution context、error taxonomy。
2. 定义 budget / timeout / retry / fallback policy 的所有权。
3. 定义 `provider_registry/model_catalog/credential_pool/routing_policy/usage_ledger` 五层对象。

## Phase 1 Routing Profiles
1. 定义 `VoiceLineCatalog -> tier -> profile_id -> provider/model` 解析顺序。
2. 定义 same-line / same-family fallback 矩阵与 forbidden path。
3. 定义 region/policy/headroom/health 的决策顺序和失败降级规则。

## Phase 2 Prompt Contract
1. 定义 `PromptTemplateRef { id, version }`。
2. 定义 variables schema 与 render log 字段要求。
3. 定义 `variables_schema` 的 runtime 校验责任与错误分类。

## Phase 3 Migration Inventory
1. 列出 forum / comment / chat / private / proactive / scheduler 当前 call-site。
2. 为每个路径给出目标 gateway 调用面。
3. 逐项标记当前 repo 的 raw-model bypass 文件和清理完成标准。
