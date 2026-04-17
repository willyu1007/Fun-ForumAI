# 03 Implementation Notes

## Status
- Current status: `in-progress`
- Last updated: 2026-04-17

## What changed
- 初始化 task bundle，记录 Stats 能力链路回归修复。
- 前端恢复 `VITE_FF_AGENT_STATS_UI`：
  - 注册到 `frontend-flags`
  - 曾接回 `frontend-capabilities`，但后续产品方向改动后不再作为 `TabIntro` 的入口控制来源
- `TabIntro` 的 `塑造` 页已经切换成新的三段式结构：
  - `基础风格`
  - `性格底色`
  - `培养建议`
- Stats 区域不再按前端 feature flag 隐藏，而是固定出现在 `塑造` 页中；真实数据可用性由后端 stats 能力和 owner 权限决定。
- 后端恢复 `FF_AGENT_STATS_*` 到 `config.launch.capabilities` 的 env 解析。
- 补充 frontend/backend 定向测试，覆盖 env override、塑造页折叠结构和 Stats 不可用反馈。
- 对本轮 UI 相关代码做质量加固：
  - `StyleControlPanel` 从 autosave 改为显式保存后，增加 `hasLocalEdits` 保护，避免 query 被动刷新覆盖未保存编辑。
  - 为 `StyleControlPanel` 增加保存失败提示，避免 silent failure。
  - 为 range slider 增加 `aria-label`，使测试与可访问性更稳定。
  - `TabIntro` 内部 `TabId` 改为只表示当前真实可达 tab；`style/instructions` 只保留在 legacy intro-section 归一化入口，不再混在活动状态类型里。
  - 移除已不再使用的 `InstructionList` 组件与对应测试 mock，避免后续开发误以为塑造页仍保留“行为指令”区。
  - `StatsPanel` 去掉旧的 diagnostics/timeline 双轨测试残留，单独校验不可用原因文案。

## Files/modules touched (high level)
- `src/frontend/shared/config/frontend-flags.ts`
- `src/frontend/shared/config/frontend-capabilities.ts`
- `src/frontend/features/agents/components/modal/TabIntro.tsx`
- `src/frontend/features/agents/components/StatsPanel.tsx`
- `src/frontend/features/agents/components/StyleControlPanel.tsx`
- `src/backend/lib/config.ts`
- `src/backend/lib/config.test.ts`
- `src/frontend/shared/config/__tests__/frontend-flags.test.ts`
- `src/frontend/shared/config/__tests__/frontend-capabilities.test.ts`
- `src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx`
- `src/frontend/features/agents/components/__tests__/StatsPanel.test.tsx`
- `dev-docs/active/agent-stats-capability-chain-reenable-v1/*`

## Decisions & tradeoffs
- Decision:
  - 前端不再把 Stats 区域显示与 `VITE_FF_AGENT_STATS_UI` 绑定。
  - Rationale:
    - 当前塑造页已经重构为固定三段式，如果继续保留旧 gate 语义，会让 UI 结构、测试和 task bundle 长期分叉。
  - Alternatives considered:
    - 保留旧 gate，再在 flag off 时隐藏 `性格底色`，但会让当前塑造页的信息架构再次双轨化。

## Deviations from plan
- Change:
  - 没有调整 env contract 中的 `VITE_FF_AGENT_STATS_UI` 定义，但前端已不再使用它控制 `TabIntro` 暴露。
  - Why:
    - 当前先解决代码和任务包之间的语义漂移；是否彻底废弃该 env key 需要单独评估 docs/context/env 的影响面。
  - Impact:
    - 运行环境里打开后端 `FF_AGENT_STATS_*` 后即可看到真实 Stats 数据；不开时前端展示准确的不可用反馈，而不是隐藏整个区块。

## Known issues / follow-ups
- 若后续决定彻底废弃 `VITE_FF_AGENT_STATS_UI`，需要单独更新 `frontend-flags` / env contract / 文档。
- 当前未做浏览器级手工联调 smoke；若要确认完整链路，还需要在打开后端 stats flags 的运行环境中走一次 owner 面板交互。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
