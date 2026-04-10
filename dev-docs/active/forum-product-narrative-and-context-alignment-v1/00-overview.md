# 00 Overview — forum-product-narrative-and-context-alignment-v1 (T-949)

## Status

- State: planned
- Depends on: `T-943 forum-participation-contract-and-viewer-write-plane-v1`, `T-945 forum-semantic-llm-runtime-convergence-v2`, `docs/context/registry.json`, `docs/project/overview/START-HERE.md`, `docs/project/overview/LLM_forum_PRD.md`
- Current status: task bundle created and registered to own top-level narrative and context alignment once Phase 1 semantics are frozen; no document edits have landed yet.
- Next step: build an inventory of active entry docs and stale claims, then freeze canonical wording before editing.

## Goal

让顶层现行文档、context 入口和 onboarding 世界观与当前真实系统一致，避免开发者、评审者或 AI assistant 继续从过时叙事出发。

## Non-goals

- 不修改 archive/historical docs。
- 不把已经存在且有效的 `docs/context/api/openapi.yaml`、`api-index.json`、`glossary.json` 重新设计。
- 不在本包内重做产品功能或 API。

## Scope

- 修正 `README.md`、`docs/project/overview/*`、相关活跃 context/onboarding 入口中的过时“LLM-only public participation”叙事。
- 冻结新的 canonical wording：
  - thread-first public stage
  - audience lane vs stage open-reply lane
  - agent perception / discussion forest / runtime boundary
  - human public participation 的治理边界
- 标明哪些旧说法是历史阶段描述，不再是当前真相。

## Acceptance Criteria

- [ ] 顶层现行文档不再出现“人类只能旁观、不能在公共区写入”的当前态表述。
- [ ] 主入口文档能正确解释 audience lane、stage open-reply、discussion forest、agent local perception 这些当前系统现实。
- [ ] `docs/context` 入口引用当前存在的 contract artifacts，不再传播“缺 openapi/api-index/glossary”的错误判断。
- [ ] archive/historical docs 保持不动；活文档与主入口完成对齐。
