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
- 将 `FF_AGENT_STATS_V1` 的运行时 fallback 从 `false` 改成 `true`，并同步更新 env contract / generated env docs，使 Stats v1 改为全环境默认开启、只有显式设置 `false` 才关闭。
- `StatsPanel` 交互改成真正的点数分配器：
  - 人格轴与能力项都改为只读结果条 + `- / +` 按钮，不再允许自由拖动。
  - 顶部摘要收敛成轻量 `待分配 / 已分配 / 累计` 信息带。
  - 单个属性块统一成三行结构：`名称 + 当前值`、`端点说明`、`结果条`。
  - 无待分配点数时禁止继续加点，但允许撤回当前草稿中的已分配点数。
  - 进一步收紧视觉密度后，将双向人格轴改成“端点文案 + 双端 `+` 按钮 + 中间值胶囊轨道”：
    - 左右两端都用 `+`，分别表示“向左端人格继续加点”和“向右端人格继续加点”。
    - 当前结果值不再悬浮在标题区，而是直接绑定到轨道落点的胶囊标记上。
    - `记忆力 / 学习力` 单独使用中性能力条，不复用人格轴的双向按钮语义。
- `StatsPanel` 顶部补回 XP 语义，但不再依赖旧的前端推导/测试假设：
  - 后端 `/agents/:agentId/xp` 明确返回 `level`、`xp_into_level`、`xp_to_next_level`、`level_progress`。
  - `性格底色` 顶部在 `可用点数` 旁显示 `等级：xx` 与到下一级的经验进度条。
  - 清理 `TabIntro.test.tsx` 中旧的 `level/xp_to_next` 假 mock，统一改回真实 XP contract。
  - 顶部控制栏再次收敛：
    - 顺序调整为 `等级 | 可用点数 | 复原 | 确认`。
    - 移除底部 `预览分配 / 清空草稿 / no-respec checkbox` 以及预览摘要区，避免同一面板出现两套操作流。
    - `确认` 现在直接提交当前草稿，`复原` 负责回到本次进入时的未编辑状态。
  - 顶部控制栏继续细化为 3 段式结构：
    - `等级`、`可用点数`、`操作区（复原/确认）` 之间增加短竖线分隔，降低同一行信息挤压感。
    - 顶栏里的 `确认` 改成更轻的 outline/tint 按钮，避免在摘要栏里形成过重 CTA。
    - 真正提交前改为弹出二次提醒弹窗，明确“本次加点立即生效且不可重置”，提交动作移入弹窗确认按钮。
    - 三段宽度进一步固定为 `1:1:1`，改为等宽 grid 列，避免摘要和按钮区继续按内容宽度互相挤压。
- Stats 初次创建默认点数从 `0/0` 提升到 `25/25`：
  - `InMemoryStatsRepository` 默认 stats 更新为 `granted_points_total=25`、`unspent_points=25`。
  - `StatsService` 的同步 fallback 默认值同步改为 `25/25`，避免缓存路径与持久层初值分叉。
  - `PgStatsRepository.getOrCreateStats()` 的 upsert create 分支同步写入 `25/25`，保证持久化环境首次创建行为一致。
- 对本轮 UI 相关代码做质量加固：
  - `StyleControlPanel` 从 autosave 改为显式保存后，增加 `hasLocalEdits` 保护，避免 query 被动刷新覆盖未保存编辑。
  - 为 `StyleControlPanel` 增加保存失败提示，避免 silent failure。
  - 为 range slider 增加 `aria-label`，使测试与可访问性更稳定。
  - `基础风格` 现已重新切回 debounce autosave：
    - 移除底部 `保存` 按钮，改为本地改动后约 `400ms` 自动提交。
    - 仅在失败时显示 `保存失败...`，不再展示 `正在保存...`，避免频繁 autosave 时产生闪烁感。
    - 自动保存成功后，将本地 slider 值归整到最终整数档位，避免 UI 与后端持久化语义漂移。
    - 查询层返回新对象时，`StyleControlPanel` 现在会先比较签名再决定是否同步 `savedSnapshot / local`，避免在 mock 或高频刷新场景里进入重复 render。
  - `TabIntro` 内部 `TabId` 改为只表示当前真实可达 tab；`style/instructions` 只保留在 legacy intro-section 归一化入口，不再混在活动状态类型里。
  - 移除已不再使用的 `InstructionList` 组件与对应测试 mock，避免后续开发误以为塑造页仍保留“行为指令”区。
  - `StatsPanel` 去掉旧的 diagnostics/timeline 双轨测试残留，单独校验不可用原因文案。
  - 修复 `StatsPanel` 中 `draftCostPoints` 在条件早退之后才调用 hook 的顺序风险，改为稳定的同步推导。

## Files/modules touched (high level)
- `src/frontend/shared/config/frontend-flags.ts`
- `src/frontend/shared/config/frontend-capabilities.ts`
- `src/frontend/features/agents/components/modal/TabIntro.tsx`
- `src/frontend/features/agents/components/StatsPanel.tsx`
- `src/frontend/features/agents/components/StyleControlPanel.tsx`
- `src/backend/lib/config.ts`
- `src/backend/lib/config.test.ts`
- `src/backend/repos/stats-repository.ts`
- `src/backend/repos/pg/pg-stats-repository.ts`
- `src/backend/services/stats-service.ts`
- `src/backend/services/__tests__/stats-service.test.ts`
- `env/contract.yaml`
- `env/.env.example`
- `docs/env.md`
- `docs/context/env/contract.json`
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
- Decision:
  - 将 `FF_AGENT_STATS_V1` 设为全环境默认开启。
  - Rationale:
    - 当前产品已经默认展示 `性格底色`，若后端继续默认关闭，就会长期制造 owner 可见但不可用的空壳状态。
  - Alternatives considered:
    - 继续要求各环境显式配置 `FF_AGENT_STATS_V1=true`，但这会把“默认行为”继续留给人工环境配置，无法保证所有环境一致。
- Decision:
  - `性格底色` 改用 `+ / -` 点数分配，而不是继续保留可自由拖动的 slider 编辑。
  - Rationale:
    - 后端接口语义是“消耗整数点数进行 allocation”，不是直接写入目标值；继续允许自由拖动会把“分配点数”误导成“任意设值”。
  - Alternatives considered:
    - 保留 slider 但在保存时 round / snap，视觉上更顺滑，但仍然无法表达“待分配点数不足时不可继续操作”的核心约束。
- Decision:
  - Stats 初次创建默认发放 `25/25` 点。
  - Rationale:
    - Owner 首次进入 `性格底色` 需要能立即感知加点交互和角色塑造结果，默认 `0/0` 会让功能看起来像“开放了但无法使用”。
  - Alternatives considered:
    - 只在 mock/dev 种子里发放点数，但会造成本地和真实持久化环境语义分叉。

## Known issues / follow-ups
- 若后续决定彻底废弃 `VITE_FF_AGENT_STATS_UI`，需要单独更新 `frontend-flags` / env contract / 文档。
- 当前未做浏览器级手工联调 smoke；若要确认完整链路，还需要在打开后端 stats flags 的运行环境中走一次 owner 面板交互。
- 若后续继续压缩 `StatsPanel` 视觉密度，优先只调整间距、按钮层级和分组，不要再把只读结果条改回“可任意拖动”的主交互。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
