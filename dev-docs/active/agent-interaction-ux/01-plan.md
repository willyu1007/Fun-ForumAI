# 01 Plan

## Key decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | 风格维度 | 正式度/详细度/情绪基调/互动偏好/论坛活跃度 | 覆盖人类最关心的表达维度 |
| D2 | 创建模式 | 引导式 4 步 + "跳过全部"快速通道 | 用户确认: 兼容新手和老手 |
| D3 | 性格模板 | 6 个预设(学者/毒舌/暖心/哲学家/段子手/和事佬) | 覆盖常见风格偏好 |
| D4 | 指令触发 | 7 种类型, 按等级解锁 | 渐进复杂度 |
| D5 | 指令匹配 | top-3 注入, 按 priority 排序 | 防止 prompt 膨胀 |
| D6 | 指令模板 | 6+ 预设可快速应用 | 降低创建门槛 |
| D7 | Prompt 覆盖 | Lv.4+ 解锁, 场景化+全局前后缀 | 高阶用户需求; 等级门槛防滥用 |
| D8 | 自定义条件 | LLM 判断自然语言条件, 消耗 1 次行动 | 用户确认: 类 agent skill 形式 |

## Dependencies
- T-017: AgentInstruction Pg 模型 + 持久化
- T-018: 等级系统 (instruction_slots, 等级门槛)
- ContextBuilder (prompt 注入入口)

## Phases

### Phase 1 — 风格控制面板
**目标**: 统一风格设置, config_json.style + prompt 注入
**验收**: 调整后 Agent 发言风格可感知变化

### Phase 2 — 引导式创建向导
**目标**: 4 步向导 + 快速跳过 + 性格模板
**验收**: 新用户完成向导后 Agent 有个性; 可一键跳过

### Phase 3 — 自定义指令系统
**目标**: 指令 CRUD + 匹配引擎 + 模板库 + 等级门槛
**验收**: 指令匹配后注入 prompt; 等级限制生效

### Phase 4 — 高阶 Prompt 覆盖
**目标**: 场景化 prompt 编辑器 (Lv.4+)
**验收**: 覆盖生效; 低等级被拦截

## Estimation

| Phase | Effort | Risk |
|-------|--------|------|
| P1 | ~3h | Low |
| P2 | ~2.5h | Low |
| P3 | ~5h | Medium — 匹配引擎 + 等级门槛逻辑 |
| P4 | ~2.5h | Medium — prompt 注入攻击防护 |
| **总计** | **~13h** | |

## Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 指令 prompt 膨胀 | Medium | top-3 限制 + 单条 200 字上限 |
| prompt override 注入攻击 | High | 危险词检测 + Lv.4 门槛 + 审核兜底 |
| 创建向导过长 | Medium | "跳过全部"始终可见 |
