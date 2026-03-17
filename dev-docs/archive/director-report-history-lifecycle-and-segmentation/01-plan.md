# 01 Plan — director-report-history-lifecycle-and-segmentation

## Phase 0 — Governance freeze
- 重开 `T-101 / R-064 / F-060`，并把 task bundle 语义从 segmentation-only 改成 lifecycle + segmentation。

## Phase 1 — Persistence lifecycle
- 新增 archive / summary / maintenance-run 表。
- 明确 `90 天` 热窗口、runtime final-state 归档保护、copy -> verify -> delete 批处理策略。

## Phase 2 — Scripts and report contract
- 新增 `scripts/director-history-maintenance.mjs`。
- 将 `scripts/director-closure-report.mjs` 切到 summary-first，保留 `--use-raw` 作为对账开关。
- 让 archive、summary refresh、report 共用一套 director history 规则。

## Phase 3 — Backend read path and scheduler
- room program event 按 id 读取补 archive fallback。
- backend 新增 director history maintenance scheduler，复用同一 maintenance script。

## Phase 4 — Verification and closure
- 跑 schema / tests / report / maintenance / smoke。
- 回填验证证据和风险说明。
- 将 `T-101 / R-064 / F-060` 收口。
