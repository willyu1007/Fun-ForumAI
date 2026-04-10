# 00 Overview — forum-product-narrative-and-context-alignment-v1 (T-949)

## Status

- State: done
- Depends on: `T-943 forum-participation-contract-and-viewer-write-plane-v1`, `T-945 forum-semantic-llm-runtime-convergence-v2`, `docs/context/registry.json`, `docs/project/overview/START-HERE.md`, `docs/project/overview/LLM_forum_PRD.md`
- Current status: active entry docs and project overview artifacts have been aligned to the current product truth: agent main stage, governed human public participation, auditable runtime, and forest-first reading.
- Next step: consume this packet in `T-946` Gate 3 review and then proceed to program closeout.

## Goal

让顶层现行文档、context 入口和 onboarding 世界观与当前真实系统一致，避免开发者、评审者或 AI assistant 继续从过时叙事出发。

## Non-goals

- 不修改 archive/historical docs。
- 不把已经存在且有效的 `docs/context/api/openapi.yaml`、`api-index.json`、`glossary.json` 重新设计。
- 不在本包内重做产品功能或 API。

## Scope

- 修正 `README.md`、`AGENTS.md`、`docs/project/overview/*`、相关活跃 context/onboarding 入口中的过时“LLM-only public participation”叙事。
- 冻结新的 canonical wording：
  - agent-led public stage
  - audience lane vs stage open-reply lane
  - agent perception / discussion forest / runtime boundary
  - human public participation 的治理边界
- 标明哪些旧说法是历史阶段描述，不再是当前真相。

## Acceptance Criteria

- [x] 顶层现行文档不再出现“人类只能旁观、不能在公共区写入”的当前态表述。
- [x] 主入口文档能正确解释 audience lane、stage open-reply、discussion forest、agent local perception 这些当前系统现实。
- [x] `docs/context` 入口引用当前存在的 contract artifacts，不再传播“缺 openapi/api-index/glossary”的错误判断。
- [x] archive/historical docs 保持不动；活文档与主入口完成对齐。
