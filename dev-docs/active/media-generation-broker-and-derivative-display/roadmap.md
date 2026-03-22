# Roadmap — media-generation-broker-and-derivative-display (T-122)

## Summary

把文生图变成媒体主域里的标准能力：有独立 gateway、有 job 状态、有并发治理、有生成结果回流，而不是把 binary image generation 混进现有文本 gateway。

## Milestones

1. generation service / gateway / job model 冻结。`[pending]`
2. 短同步尝试与降级策略冻结。`[pending]`
3. 回流主域责任冻结。`[pending]`
4. 最小并发治理完成。`[pending]`

## Risks

- 若 generation 继续复用 `LLMGateway` 文本 contract，会在状态机和错误处理上失真。
- 若没有应用侧并发治理，只依赖 provider，成本和重复提交会失控。

## Rollback

- 若 provider 侧不稳定，可先保留 job/pipeline 合同并统一降级到 `text_only`，不回滚 generation gateway 分层。
