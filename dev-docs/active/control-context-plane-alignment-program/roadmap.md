# Control Context Plane Alignment Program — Roadmap

## Goal
- 将 API-key Control Plane 与 Context Memory Plane 从规划基线推进到受治理的实现主线，补齐任务映射、依赖顺序、验收口径与回滚边界。

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-approved plan | 当前会话（2026-03-09） | 任务拆分、执行顺序、首批边界 | highest | 明确要求总控 + 双子包 |
| Existing gateway contract | `dev-docs/active/llm-gateway-routing-profiles-v1` | Control Plane 合同基线 | high | `T-064` 已冻结 contract，不含 runtime |
| Existing persona program | `dev-docs/active/persona-provider-alignment-program` | `F-020` 语义与依赖排序 | high | 新包不能覆写 `T-062~T-066` 边界 |
| Current runtime | `src/backend/llm/**`, `src/backend/services/**`, `src/backend/runtime/**` | 现状断点、迁移挂点 | high | 仍为单 `config.llm + LlmClient` 与 prose memory |
| External design docs | `/Users/yurui/Downloads/Fun-ForumAI_ControlPlane_ContextMemory_docs/*.md` | Control/Context 机制设计基线 | high | 作为新增实现包语义来源 |

## Frozen decisions
- 任务组织固定为 `T-067 + (T-068, T-069)`。
- 执行顺序固定为 `T-067 -> T-068 -> T-069 -> T-066`。
- `T-068` 继续挂载 `R-027`，承接 runtime implementation。
- 新增 `R-030 Context and Memory Plane`，由 `T-069` 承接。
- `T-065` 继续只管 overlay / short-term runtime，不承接长期 context。
- `T-066` 继续只管 observability / eval / rollout gate，不在本轮提前收编实现细节。

## Package matrix
| Package | Requirement | Purpose | Depends on |
|---|---|---|---|
| `T-067` | `R-027`, `R-030` | 主协调包；冻结边界、依赖、DoD、回滚策略 | `T-064`, current repo evidence |
| `T-068` | `R-027` | 实现 secret resolver、credential pool、gateway、usage ledger、call-site migration | `T-064`, env contract SSOT |
| `T-069` | `R-030` | 实现 typed context stores、summary pipeline、retrieval、MemoryPack | `T-068`, current memory/prompt runtime |

## Acceptance criteria
- `T-067~T-069` 都存在完整 bundle 与 project hub 映射。
- `T-068` 产出可运行的 single calling surface，并移除生产调用面的直接 `llmClient.chat(...)` 旁路。
- `T-069` 保持 `memoryService.getMemoriesForContext()` 外部签名稳定，同时把内部检索升级为 typed retrieval + MemoryPack。
- 本轮不引入新 MQ / vector DB / 控制台 UI。
