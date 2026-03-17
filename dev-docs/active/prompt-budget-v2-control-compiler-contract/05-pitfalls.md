# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要把 V2 block 重新实现成 legacy layer 的换名透传。
- 不要让 `requestEnvelope` 和 `localLayerEnvelope` 继续混成一个模糊 budget。
- 不要把 privacy/style/overrides 的归属留给后续实现者临场决定。
- 不要让 gateway passive window validation 影响 routing。
- 不要把 `scheduled_post` 单独特化成另一套 budget contract，除非先有实证。
- 不要在 V2 第一版里临时加入“高价值 visible actor 自动升厚”这类未冻结策略。

## Risk watchlist
- 风险：route 仍直接决定最终 block 长度，orchestrator 只做记录。
  - 预防：raw-source contract 只传原料，不传预裁剪结果。
- 风险：route/service 以不同公式各自计算可用 budget，导致 local envelope 漂移。
  - 预防：唯一合法公式定义在本包 architecture；route 只能报 overhead，不得自行扣预算。
- 风险：V2 模板同时继续依赖 legacy source layer，authority 继续混乱。
  - 预防：public V2 templates 强制只消费编译后 block 变量。
- 风险：audit 字段命名延续旧 trim 语义，无法解释新 compiler 结果。
  - 预防：在实现开始前先冻结 `PromptBudgetDecision` 和 warning taxonomy。
