# 03 Implementation Notes

## Current status
- 状态：planned
- 说明：任务包已冻结 public-scene authority、V2 template contract 和 passive window validation 的边界，尚未开始代码实现。

## Ready checklist
- [x] scene budget config、bucket taxonomy 和 control-tier vocabulary 已锁定
- [x] `requestEnvelope` / `localLayerEnvelope` ownership 与公式已锁定
- [x] privacy/style/overrides 的 V2 block 映射已锁定
- [x] public scenes 的迁移顺序已锁定为 `forum_post -> forum_comment -> scheduled_post`
- [x] `scheduled_post` 默认复用 `forum_post` config 的决策已锁定
- [x] model-window 元数据只做被动校验、不参与 routing 的决策已锁定
- [x] visible actor 不自动升厚 envelope 的决策已锁定
- [x] Package 1 / 2 / 3 的职责边界已拆分完成

## 2026-03-17 planning log
- 新建 `T-114` task bundle，承接 Token Budget V2 的 public-scene contract 与 control compiler 基线。
- 记录新类型、request/local envelope contract、raw-source contract、V2 template block contract 和 gateway passive validation 范围。
- 冻结全部 scene 的默认 request budget 和 package-level bucket defaults，避免后续实现者自定默认值。
- 将本包映射到 `R-021`，并以 `R-027` 作为 secondary dependency。

## Handoff notes
- 实现时先冻结类型、token-math 公式与 audit schema，再迁 public templates；不要反过来先改模板再补 authority。
- gateway passive validation 必须保持 warning-only；任何 hard fail 都应留给后续独立任务讨论。
- 在 Package 2 未落地前，允许 memory 通过兼容 adapter 进入 `memory_block`，但不得让 adapter 重新主导 budget authority。
- 进入 Package 2 前，必须把 public-scene review gate 的 evidence 和结论写回本包 `04-verification.md` / `03-implementation-notes.md`。
