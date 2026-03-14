# 02 Architecture — scene-pool-authoring-v2-hardening-and-e2e-followup

## Current standard
- Authoring source of truth: `docs/stage-templates/source/**`
- Runtime dist output: `docs/stage-templates/dist/**`
- Runtime catalog contract: `version: "v2"` + `contract_version: "public_director_contract_v1"`

## Hardening boundary
- `T-100` 不改变 runtime catalog 结构，只验证并强化这套边界。
- 需要被清除的是“旧路径仍像现行入口一样出现”的语义漂移，而不是历史事实本身。
- 归档文档允许保留“曾经存在 legacy source path”的事实，但不能继续给出失效精确路径，否则 LLM 会把它当成当前 SoT。

## Guard model
- 旧 token 默认零容忍。
- 如必须允许极少数例外，只能集中写在 guard allowlist 中，并附带原因。
- 业务实现、测试夹具、治理文档和报告脚本都必须服从同一规则。
