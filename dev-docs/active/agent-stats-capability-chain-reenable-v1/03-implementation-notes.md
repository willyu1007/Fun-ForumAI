# 03 Implementation Notes

## Status
- Current status: `in-progress`
- Last updated: 2026-04-15

## What changed
- 初始化 task bundle，记录 Stats 能力链路回归修复。
- 前端恢复 `VITE_FF_AGENT_STATS_UI`：
  - 注册到 `frontend-flags`
  - 接回 `frontend-capabilities`
- `TabIntro` 的 `塑造` 页恢复 Stats capability 门控：
  - flag on 时渲染 `StatsPanel`
  - flag off 时只保留已合并的设定/指令内容
- 后端恢复 `FF_AGENT_STATS_*` 到 `config.launch.capabilities` 的 env 解析。
- 补充 frontend/backend 定向测试，覆盖 env override 和 `TabIntro` flag-off 回归。
- 对本轮 UI 相关代码做质量加固：
  - `StyleControlPanel` 从 autosave 改为显式保存后，增加 `hasLocalEdits` 保护，避免 query 被动刷新覆盖未保存编辑。
  - 为 `StyleControlPanel` 增加保存失败提示，避免 silent failure。
  - 为 range slider 增加 `aria-label`，使测试与可访问性更稳定。
  - `TabIntro` 内部 `TabId` 改为只表示当前真实可达 tab；`style/instructions` 只保留在 legacy intro-section 归一化入口，不再混在活动状态类型里。

## Files/modules touched (high level)
- `src/frontend/shared/config/frontend-flags.ts`
- `src/frontend/shared/config/frontend-capabilities.ts`
- `src/frontend/features/agents/components/modal/TabIntro.tsx`
- `src/backend/lib/config.ts`
- `src/backend/lib/config.test.ts`
- `src/frontend/shared/config/__tests__/frontend-flags.test.ts`
- `src/frontend/shared/config/__tests__/frontend-capabilities.test.ts`
- `src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx`
- `dev-docs/active/agent-stats-capability-chain-reenable-v1/*`

## Decisions & tradeoffs
- Decision:
  - 先恢复 env-driven wiring，再决定是否调整默认值。
  - Rationale:
    - 当前主要问题是能力链路失联，不是默认值本身。
  - Alternatives considered:
    - 直接把 Stats 默认值改成 true，但会改变 env contract 语义且扩大影响面。

## Deviations from plan
- Change:
  - 没有把本地默认值改成开启状态。
  - Why:
    - 现阶段先修回 env-driven wiring，避免直接改变 env contract 默认语义。
  - Impact:
    - 需要在实际运行环境中显式设置 `FF_AGENT_STATS_*` / `VITE_FF_AGENT_STATS_UI=true` 才会真正开启。

## Known issues / follow-ups
- 如果后续希望本地 dev 默认展示 Stats，需要单独评估是否调整 env 默认值或补充快捷启动命令。
- 当前未做浏览器级手工联调 smoke；若要确认完整链路，还需要在打开前后端 stats flags 的运行环境中走一次 owner 面板交互。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
