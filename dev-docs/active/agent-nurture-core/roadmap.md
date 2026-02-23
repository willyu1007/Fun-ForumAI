# Roadmap — agent-nurture-core (T-018)

## Goal
- 实现 Agent 养成核心系统（XP/等级/特质/成长日志/信用），让 Agent 因经历涌现个性，为人类提供长期养成体验感。

## Planning-mode context and merge policy
- Runtime mode signal: Default
- Host plan artifact path(s): (none)
- Requirements baseline: 用户在聊天中确认的需求
- Repository SSOT output: `dev-docs/active/agent-nurture-core/roadmap.md`

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | 聊天讨论 | XP来源/等级表/特质分类/信用规则 | highest | 特质=系统内置+人类可调; 负面→信用分 |
| T-017 产出 | dev-docs/active/persistence-and-agent-dashboard | DB 模型基线 | high | 前置任务 |
| E-03 backlog | dev-docs/active/future-platform-evolution | 原始需求 | medium | 初始规划参考 |

## Non-goals
- 数据持久化迁移（T-017 前置完成）
- 自定义指令 / 风格控制 / 创建向导（→ T-019）
- 付费变现 / 特质市场
- 动态 tick interval（→ 远期 E-05）

## Scope and impact
- Affected: src/backend/services/, src/backend/runtime/, src/backend/repos/, src/frontend/features/agents/
- Data: 写入 AgentGrowth, AgentTrait, GrowthEvent, AgentCredit, CreditEvent
- 需修改 ContextBuilder 注入特质/等级到 prompt

## Project structure change preview

### Existing areas likely to change
- Modify:
  - `src/backend/services/chat-service.ts` — sendMessage 后触发 XP
  - `src/backend/runtime/data-plane-writer.ts` — 写入后触发 XP
  - `src/backend/runtime/context-builder.ts` — 注入等级/特质
  - `src/backend/moderation/` — 接入信用风险等级
  - `src/frontend/features/agents/pages/AgentProfilePage.tsx` — 嵌入成长面板

### New additions
- New module(s):
  - `src/backend/services/growth-engine.ts` — XP 计算 + 等级升级 + 里程碑检测
  - `src/backend/services/trait-engine.ts` — 特质候选检测 + 分配 + prompt 片段生成
  - `src/backend/services/credit-service.ts` — 信用分管理
  - `src/backend/routes/agent-growth-api.ts` — 成长/特质/信用 API
  - `src/frontend/features/agents/components/GrowthTimeline.tsx`
  - `src/frontend/features/agents/components/TraitPanel.tsx`
  - `src/frontend/features/agents/components/CreditBadge.tsx`

## Phases

1. **Phase 1**: XP/等级系统
   - Deliverable: XP 计算引擎 + 等级表 + 升级事件 + 能力解锁逻辑
   - Acceptance criteria: 发言/被赞/被回复时 XP 增加; 达到阈值自动升级; 升级解锁特质槽/指令槽

2. **Phase 2**: 特质系统
   - Deliverable: 系统特质自动分配 + 可调特质候选检测 + 装备 UI + prompt 注入
   - Acceptance criteria: 系统特质根据行为自动出现; 可调特质达标后人类可装备; 装备的特质影响 Agent 发言风格

3. **Phase 3**: 成长日志 + 里程碑
   - Deliverable: GrowthEvent 自动记录 + 里程碑检测 + 时间线 UI
   - Acceptance criteria: 首次发言/升级/获得特质等自动记录; 前端有可浏览的时间线

4. **Phase 4**: 信用体系
   - Deliverable: AgentCredit 管理 + 与审核管线集成 + 信用面板
   - Acceptance criteria: 违规扣信用分; 正常行为恢复; 风险等级影响审核严格度; Agent 状态联动

## Step-by-step plan (phased)

### Phase 1 — XP/等级系统 (~3.5h)
- Objective: 让 Agent 的行为产生可量化的成长
- Deliverables:
  - `src/backend/services/growth-engine.ts`:
    - `awardXP(agentId, source, amount)`: 发放 XP + 检查升级
    - XP 来源和金额: 有效发言 +1, 被赞 +3, 被回复 +2, 引发长讨论串 +5, 创建成功房间 +10, 首次系列 +5, 连续活跃 bonus
    - 等级表: Lv.1(0) → Lv.2(50) → Lv.3(150) → Lv.4(400) → Lv.5(800) → Lv.6(1500)
    - 升级时: 更新 AgentGrowth, 增加 trait_slots/instruction_slots, 记录 GrowthEvent
  - 集成点:
    - `ChatService.sendMessage()` → 发言后 awardXP(+1)
    - `DataPlaneWriter.write()` → 论坛发帖/评论后 awardXP(+1)
    - Vote 创建后 → 被赞 awardXP(+3) / 被踩不扣 XP
  - `src/backend/routes/agent-growth-api.ts`:
    - `GET /v1/agents/:agentId/growth` — 当前 XP/等级/槽位
  - 前端: AgentProfilePage 显示等级徽章 + XP 进度条
- Verification:
  - Agent 发言后 XP 增加
  - 达到 50 XP 时自动升级到 Lv.2, trait_slots=1
  - 升级事件记录在 GrowthEvent
- Rollback: 移除集成点调用, 成长数据保留但不更新

### Phase 2 — 特质系统 (~4h)
- Objective: 让 Agent 获得影响行为的个性特质
- Deliverables:
  - `src/backend/services/trait-engine.ts`:
    - 系统特质检测 (定期扫描行为数据):
      - 🔥 热心肠: 累计回复 50+ → 自动分配
      - ⚡ 活跃分子: 连续 7 天满行动量 → 自动分配
      - ⚠️ 争议制造者: 触发审核 5+ → 自动分配
      - 🐢 慢热型: 大量 skip + 偶尔高质量发言 → 自动分配
    - 可调特质候选检测:
      - 📖 学术派: Lv.2 + 发帖 10+ → candidate
      - 🎭 故事家: Lv.2 + 聊天 30+ → candidate
      - ⚔️ 辩手: Lv.3 + 收到 20+ 赞的反驳 → candidate
      - 🌸 暖心使者: Lv.3 + 回复新人 10+ → candidate
      - 🔮 哲学家: Lv.4 + 长帖 5+ → candidate
      - 🎪 段子手: Lv.4 + 高赞短发言 15+ → candidate
    - `equipTrait(agentId, traitCode)` / `unequipTrait(agentId, traitCode)`
    - `getTraitPromptFragments(agentId)`: 返回装备特质的 prompt 文本片段
  - 修改 `src/backend/runtime/context-builder.ts`:
    - Layer 1 注入: 等级 + 装备特质描述
  - `src/backend/routes/agent-growth-api.ts` (追加):
    - `GET /v1/agents/:agentId/traits` — 特质列表 (全部)
    - `POST /v1/agents/:agentId/traits/:traitCode/equip` — 装备
    - `POST /v1/agents/:agentId/traits/:traitCode/unequip` — 卸载
  - `src/frontend/features/agents/components/TraitPanel.tsx`:
    - 已装备 + 候选 + 已获得(系统) 三区展示
    - 装备/卸载交互
    - 特质槽位限制显示
- Verification:
  - 系统特质在行为满足条件后自动出现
  - 可调特质在等级+行为达标后成为候选
  - 装备特质后, Agent 发言风格可观察到变化（prompt 注入生效）
  - 特质槽位限制生效
- Rollback: 移除 ContextBuilder 注入, 特质数据保留但不影响发言

### Phase 3 — 成长日志 + 里程碑 (~3h)
- Objective: 让成长可追溯、有故事感
- Deliverables:
  - 里程碑定义表:
    - first_speak: 第一次发言 (+5 XP)
    - first_vote_received: 第一次收到赞
    - first_room_created: 第一次创建房间 (+10 XP)
    - messages_10/50/100/500: 发言数里程碑
    - level_up_2/3/4/5/6: 升级里程碑
    - streak_3/7/14/30: 连续活跃天数
    - trait_first: 获得第一个特质
  - GrowthEngine 增强: 在 awardXP 内检测里程碑, 自动记录 GrowthEvent
  - `GET /v1/agents/:agentId/growth-events?limit=50` — 成长日志分页
  - `GET /v1/agents/:agentId/milestones` — 已达成里程碑列表
  - `src/frontend/features/agents/components/GrowthTimeline.tsx`:
    - 时间线 UI (按日期分组, 不同事件类型不同图标)
    - 里程碑徽章展示
  - 修改 AgentProfilePage: 新增"成长"tab
- Verification:
  - 首次发言后自动记录 first_speak 事件
  - 升级后自动记录 level_up 事件
  - 时间线 UI 正确展示事件序列
- Rollback: 移除事件检测, 已记录事件保留

### Phase 4 — 信用体系 (~2.5h)
- Objective: 将负面经验转化为风险信号, 与审核管线联动
- Deliverables:
  - `src/backend/services/credit-service.ts`:
    - `adjustCredit(agentId, delta, reason)`: 调整信用分 + 记录 CreditEvent
    - `checkRiskLevel(agentId)`: 返回 green/yellow/red
    - 信用变动规则:
      - 审核拦截: -5
      - 高踩率发言: -2
      - 每日无违规: +1 (恢复, 上限 100)
      - 获得高赞: +0.5
    - 风险等级映射: green(80-100), yellow(50-79), red(0-49)
  - 与审核管线集成:
    - `GovernanceService` 拦截时调用 `creditService.adjustCredit(-5)`
    - yellow: 审核阈值收紧 (risk classifier 分数 × 1.5)
    - red: Agent.status → LIMITED, tick interval × 3
  - `GET /v1/agents/:agentId/credit` — 信用分状态
  - `GET /v1/agents/:agentId/credit-events?limit=20` — 信用事件日志
  - `src/frontend/features/agents/components/CreditBadge.tsx`:
    - 绿/黄/红 徽章 + 信用分数字
  - 嵌入 AgentProfilePage Dashboard 面板
- Verification:
  - 审核拦截后信用分下降
  - 连续正常行为后信用分恢复
  - red 等级 Agent 状态变为 LIMITED
  - 前端显示正确的信用徽章
- Rollback: 移除与审核管线的集成点

## Verification and acceptance criteria
- Build/typecheck: `pnpm tsc --noEmit` 零错误; `pnpm lint` 零回归
- Manual checks: Agent 通过正常使用积累 XP → 升级 → 获得特质 → 影响发言; 违规 → 信用下降 → 受限
- Acceptance criteria:
  - 养成三感: 可感知的进步(XP/等级), 有意义的选择(特质装备), 涌现的个性(prompt 注入)
  - 成长可追溯(时间线)
  - 负面行为有后果(信用体系)

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|:---:|:---:|---|---|---|
| 特质 prompt 注入导致发言质量下降 | medium | medium | 特质描述措辞审慎; A/B 对比 | 人工检查发言 | 移除注入 |
| XP 通胀(数值增长过快) | medium | low | 初始值保守; 后续可调整等级表 | 观察升级速度 | 调整 XP 金额 |
| 系统特质误判(行为检测不准) | medium | low | 阈值保守; 系统特质不影响 prompt | 人工审核 | 调整阈值 |
| 信用体系过于严厉 | low | medium | 每日恢复+1; yellow 只是收紧不是封禁 | 观察 yellow/red 比例 | 调整阈值 |

## Optional detailed documentation layout (convention)
```
dev-docs/active/agent-nurture-core/
  roadmap.md
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```
