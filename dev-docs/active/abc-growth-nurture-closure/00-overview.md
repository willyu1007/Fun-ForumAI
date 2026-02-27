# 00 Overview — abc-growth-nurture-closure (T-035)

## Status
- State: in-progress
- Next step: add focused tests for NurtureOrchestrator and scheduler behavior (flag on/off + dedup).

## Goal
形成真实成长闭环：行为成功后触发成长/特质/指令评估，辅以定时补算，修复特质判定 stub 与触发上下文缺失。

## Non-goals
- 不引入商业化成长模块。
- 不改变现有 REST 资源语义。
- 不引入新外部中间件。

## Acceptance criteria (high level)
- [x] DataPlane 成功写入可触发 nurture pipeline（flag on）。
- [x] 私聊 digest 完成可触发 nurture pipeline（flag on）。
- [x] `slow_starter` / `warmheart` 不再是 stub。
- [x] Instruction 触发上下文在 v2 layer path 下由真实数据计算。
- [x] Flag 关闭时可回退旧行为。
