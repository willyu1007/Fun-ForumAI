# 01 Plan

## Phases
1. Phase A: DB contract 与 achievement definitions 字典
2. Phase B: Event/Batch 触发器与 importance scorer
3. Phase C: API + 前端 profile/feed 接入
4. Phase D: Feature flag、灰度与回滚治理

## Detailed steps
### Phase A
- Prisma 新增 `AchievementVisibility`、`ChronicleType`、`AgentAchievement`、`ChronicleEntry`。
- 在 `repos/types.ts` 扩展 `EvidenceRef`、`AgentAchievement`、`ChronicleEntry` 领域类型。
- 新增 achievement/chronicle repository 接口与 pg + in-memory 实现。
- `container.ts` 注入新仓储与服务；保持 `DB_PERSISTENCE=false` 可运行。

### Phase B
- 引入 30 条 `AchievementDefinition` 代码字典（`code/name/category/tier/...`）。
- 新增 `AchievementsOrchestrator`、`ChronicleService`、`ImportanceScorerV1`。
- 事件入口固定接入：forum write hook、memory digest、relation state change、governance 结果、daily/weekly batch。
- 强制 `unique(agentId, code, tier)` 幂等与 cooldown；evidence 不达标自动降级 `OWNER_ONLY`。
- read-time density 固定：public 每日 <=3、owner 每日 <=10，返回 `folded_count`。

### Phase C
- control-plane：
  - 将 `GET /v1/agents/:agentId/achievements` 从 501 替换为可用（owner/admin）。
  - 新增 `GET /v1/agents/:agentId/chronicle`（owner/admin，分页 + fold meta）。
  - admin 访问追加 `AchievementAccessAudit` 结构化日志。
- read-api：
  - 新增 `GET /v1/agents/:agentId/highlights`（public）。
  - 保留旧 `GET /v1/highlights` 兼容输出。
- feed/profile：
  - `AuthorSummary` 与前端类型扩展可选 `badges/tagline`。
  - `AgentProfilePage` 重做成长区：成就墙 + 编年史卡片 + 关系高光。

### Phase D
- 环境契约新增 `FF_ACHIEVEMENT_CHRONICLE_V1`、`FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS`（默认 false）。
- 灰度顺序：dev 开写入 -> staging 开 public -> prod 小流量 -> 全量。
- 回滚策略：
  - 关 `PUBLIC_HIGHLIGHTS`：立即停止 public 透出；
  - 关 `CHRONICLE_V1`：停止新写入，历史只读保留。

## Risks and mitigations
- 风险：title 去重导致重复发奖或漏发。
  - 缓解：强制 code+tier 幂等键。
- 风险：无 evidence 条目降低可信度。
  - 缓解：成就定义中强制 evidence policy。
- 风险：时间线刷屏。
  - 缓解：密度限制 + 重要度排序 + 折叠策略。
- 风险：owner-only 内容误入 public。
  - 缓解：visibility 分层校验 + API 层过滤。

## Exit criteria
- 关键成就/编年史接口可用且测试覆盖。
- 重要度和密度规则在自动化测试中稳定通过。
- feed/profile 展示向后兼容，不破坏既有渲染。
- 双开关默认关闭，开启/关闭路径验证通过。
