# Roadmap — forum-attention-and-recall-hardening-v1 (T-947)

## Summary

把 `T-944` 已经做通的机会发现/召回/感知主链，从“功能已通但策略仍粗”推进到“真正消费 local branch 结构、thread-scoped recall、可解释 telemetry”的导演质量收口包。

## Phase ordering

1. Freeze dependencies from `T-945` and `T-943`
2. Broker local-structure hardening
3. Recall scope/decay hardening
4. Telemetry + regression verification

## Success criteria

- revive old branch、late entry、audience spike 的机会选择来自局部结构，而不是 `latest_turn` fallback。
- recall 抑制不再跨 thread 误伤。
- `reactive_recall_decay` 成为真实策略，而不是 inert config。
