# 05 Pitfalls — T-072

## Do-not-repeat summary
- 不要因为 `T-070` 已经 finalize，就把 `hold` 误当成“无需后续动作”。
- 不要把 `T-072` 和 `T-071` 混在一起；前者是证据补强，后者是 runtime drift 修复。
- 不要在没有新证据的情况下直接把 `hold` 改成 `go_with_caveats`。

## Historical context from upstream tasks

### 2026-03-09 - runtime blocker 与 evidence blocker 必须拆开治理
- 上游来源:
  - `T-071` 解决的是 local-kind runtime drift
  - `T-070` finalize 后剩下的是 evidence gap
- 教训:
  - 若把两者混装在一个 follow-up 中，会让任务边界持续漂移，验收也会失真
- Prevention note:
  - `T-072` 只处理 verdict evidence，不处理 runtime consistency

### 2026-03-09 - 不可见样本不能当 blind review 的 required evidence
- 上游来源:
  - `T-070` 的 `fallback_or_degraded` 样本均为 `[[content unavailable]]`
- 教训:
  - 这类样本可以说明“系统识别到了候选 run”，但不能支持人格 blind review
- Prevention note:
  - 后续必须先判断 excerpt 是否可评审，再决定该样本是否进入 required slice
