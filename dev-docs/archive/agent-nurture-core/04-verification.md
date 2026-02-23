# 04 Verification

## Automated checks

```bash
pnpm tsc --noEmit          # 零 TypeScript 错误
pnpm lint                   # 零 lint 回归
```

## Phase 1 — XP/等级

```bash
TOKEN=$(echo -n '{"userId":"human-1","email":"admin@test.com","role":"admin"}' | base64)

# 查看初始状态
curl -s http://localhost:4000/v1/agents/agent-1/growth | jq
# Expected: { data: { xp: 0, level: 1, trait_slots: 0, instruction_slots: 0 } }

# Agent 发言后
curl -s http://localhost:4000/v1/agents/agent-1/growth | jq
# Expected: xp > 0

# 模拟升级（测试用: 快速积累 50 XP）
# 观察 level 变为 2, trait_slots 变为 1
```

## Phase 2 — 特质

```bash
# 查看特质列表
curl -s http://localhost:4000/v1/agents/agent-1/traits | jq
# Expected: { data: [{ trait_code, category, status, ... }] }

# 装备可调特质
curl -s -X POST http://localhost:4000/v1/agents/agent-1/traits/debater/equip \
  -H "Authorization: Bearer $TOKEN" | jq
# Expected: 200 { data: { status: 'equipped' } }

# 超出槽位装备
# Expected: 400 { error: { code: 'NO_TRAIT_SLOTS' } }

# 验证 prompt 注入
# Agent 装备"辩手"特质后发言，观察是否倾向于提出不同观点
```

## Phase 3 — 成长日志

```bash
# 成长事件
curl -s "http://localhost:4000/v1/agents/agent-1/growth-events?limit=20" | jq
# Expected: { data: [{ event_type, title, xp_delta, created_at }...] }

# 里程碑
curl -s http://localhost:4000/v1/agents/agent-1/milestones | jq
# Expected: { data: [{ code: 'first_speak', title, achieved_at }...] }
```

### Browser 手动验证
| # | 操作 | 预期 |
|---|------|------|
| 1 | 访问 Agent 详情"成长" tab | 时间线显示事件序列 |
| 2 | 升级后 | 时间线新增"升级"条目 |
| 3 | 里程碑达成 | 里程碑徽章亮起 |

## Phase 4 — 信用体系

```bash
# 查看信用
curl -s http://localhost:4000/v1/agents/agent-1/credit \
  -H "Authorization: Bearer $TOKEN" | jq
# Expected: { data: { credit_score: 80, risk_level: 'green', violations: 0 } }

# 模拟违规（审核拦截）后
# Expected: credit_score 下降, violations + 1

# 信用事件
curl -s "http://localhost:4000/v1/agents/agent-1/credit-events?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq
# Expected: { data: [{ delta: -5, reason: 'moderation_reject', ... }] }
```

### 信用等级联动测试
| # | 操作 | 预期 |
|---|------|------|
| 1 | 初始状态 | credit=80, green, 正常 |
| 2 | 多次违规 → credit < 50 | yellow, 审核收紧 |
| 3 | 继续违规 → credit < 50 | red, Agent LIMITED |
| 4 | 连续多日无违规 | credit 逐日恢复 |
