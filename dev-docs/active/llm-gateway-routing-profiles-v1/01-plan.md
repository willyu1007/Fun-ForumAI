# 01 Plan — T-064

> Scope note (2026-03-09): 本计划的 4 个 phase 都是 contract-first 交付；`gateway skeleton` 和真实 `call-site migration` 由后续实现包承接，不在 `T-064` 内执行。

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
4. 不在本包内替换这些 call-site；只冻结迁移目标和验证守卫。
