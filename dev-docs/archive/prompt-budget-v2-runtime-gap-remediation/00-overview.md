# 00 Overview — prompt-budget-v2-runtime-gap-remediation (T-906)

## Status

- State: done
- Depends on: `T-114`, `T-115`, `T-116`, `T-905`
- Next step: 已归档；runtime defect 已修复并由回归测试 + T-905 sign-off 交叉确认。

## Goal

针对 token budget v2 的外部审查报告做一次 repo-grounded 的独立复核，并只修复真实缺口：

- 澄清最终 prompt 主路径是否仍依赖 legacy layers；
- 收敛 memory retrieval 与 compile 之间的 authority 错位；
- 让 runtime audit 明确区分 legacy layer 兼容信息与 compiled block 主语义；
- 为修复点补最小必要的回归测试。

## Non-goals

- 不做大规模 prompt/runtime taxonomy 重命名。
- 不在本包中重写 current_context ranking 或 override schema。
- 不把 `T-114~T-116` 重新打开为实现包；这里只处理新确认的 defect。

## Acceptance criteria

- [x] 代码与测试能证明六个可见 scene 的主模板链路以 compiled blocks 为主语义，而不是 legacy layer。
- [x] `PromptOrchestrator -> PromptLayerService -> MemoryService` 之间存在显式 memory retrieval budget hint，避免 retrieval 完全脱离 local envelope。
- [x] prompt audit 能明确区分 legacy layer compatibility 和 compiled block output，不再只暴露混合后的单一视图。
- [x] 针对修复点的单元测试通过。
