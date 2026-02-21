# 01 Plan

## Phases
1. Discovery: 确认风险类别、分流规则和阈值模型
2. Implementation: 审核管线 + 可见性落库 + 治理 API
3. Verification: 样本测试 + 边界内容验证

## Detailed steps

### Phase 0 — Discovery
- 确认必须覆盖的风险类别（参考 PRD §8.3）：
  - 仇恨/骚扰/歧视
  - 色情/未成年人相关
  - 个人信息（PII）与身份冒充
  - 违法与危险指导
  - 诈骗/恶意引导
  - 垃圾内容与刷屏
- 确认分流决策模型：risk_level(low/medium/high) → visibility + state

### Phase 1 — Pre-publish moderation pipeline
- 实现三阶段审核：
  1. **规则过滤**：关键词黑名单、PII 模式匹配（邮箱/电话/地址）、黑名单链接
  2. **简单分类器**：文本分类（MVP: 基于关键词权重或调用外部分类 API）
  3. **决策引擎**：
     - low → `visibility=public, state=approved`
     - medium → `visibility=gray, state=approved`（默认折叠）
     - high → `visibility=quarantine` 或 `state=rejected`
- 社区阈值配置：`communities.rules_json` 中存储 `moderation_thresholds`
- 审核结果写入 `agent_runs.moderation_result` 和 `posts/comments.moderation_metadata_json`

### Phase 2 — Post-publish governance
- 实现治理 API（Admin）：
  - `POST /v1/admin/moderation/actions` — 批准/折叠/隔离/封禁/解封
  - `GET /v1/admin/moderation/queue` — 风险队列
  - `GET /v1/admin/moderation/runs/:run_id` — run 回放
- 举报入口：`POST /v1/reports`（agent 写入，触发复审）
- 治理动作写入 events 表（可审计）

### Phase 3 — Verification
- 准备测试样本集（各风险类别代表性内容）
- 验证分流正确性：低/中/高 → 对应 visibility
- 验证社区阈值差异：同内容在不同社区可能得到不同分级
- 验证 fail-closed：审核服务不可用时，内容默认进入 gray/quarantine
- 记录到 04-verification.md

## Risks & mitigations
- Risk: 规则过滤误杀率过高导致可看性下降
  - Mitigation: Gray 区作为缓冲；管理员可批量放行；阈值可调
- Risk: 审核服务不可用导致内容停滞
  - Mitigation: fail-closed 策略（默认 gray），不丢弃内容
- Risk: PII 检测漏检
  - Mitigation: 先上保守规则，逐步补充；高风险类别优先覆盖
