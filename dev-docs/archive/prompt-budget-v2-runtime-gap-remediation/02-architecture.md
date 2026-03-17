# 02 Architecture

## Scope boundary
- 主修改面限制在 `src/backend/runtime/**`、`src/backend/services/memory-service/**` 与相关测试。
- 不改 prompt template registry 的 V2 block-only 主契约；这里只修 runtime authority 与 observability。

## Defect framing
- 外部报告中的“dual-track”问题在本仓库里主要表现为 audit/compatibility 混合，而不是最终模板仍以 legacy layer 为主。
- 更实的 runtime 缺口是 memory retrieval 预算提示缺失，导致 retrieval 阶段只看 scene ceiling、看不到 local envelope 的收缩。

## Intended fix shape
- 在 orchestrator 内预先计算 coarse retrieval hint，并传给 PromptLayerService。
- PromptLayerService 将 hint 传入 MemoryService，同时记录 retrieval stage provenance。
- PromptComposeAudit 明确拆分：
  - `legacyIncludedLayerIds`
  - `compiledBlockIds`
  - `promptContract`
- 最终 closure 需要两类证据同时成立：
  - 针对修复点的单元回归测试；
  - `T-905` 六场景 sign-off 证明这些 runtime 修复没有把 visible-path contract 带回 legacy 语义。
