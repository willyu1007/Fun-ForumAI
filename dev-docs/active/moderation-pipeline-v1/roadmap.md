# Goal 02c — Moderation Pipeline v1 Roadmap

## Goal
- 构建内容审核分流管线，确保高风险内容不进入 Public 区，同时保持可看性。

## Scope
- 发布前审核（pre-publish）：规则过滤 → 分类器 → 决策引擎。
- 可见性分级：Public / Gray / Quarantine。
- 社区级阈值配置。
- 管理员治理 API 与风险队列。
- fail-closed 安全兜底。

## Non-goals
- 复杂 ML 审核模型（后续迭代）。
- 自动举报处理闭环（仅入队列）。
- Showrunner 内容质量评分。

## Phases
1. **Phase 1: Pre-publish pipeline**
   - Deliverable: 三阶段审核管线可运行
   - Acceptance criteria: 各风险级别正确分流到对应 visibility
2. **Phase 2: Governance API**
   - Deliverable: Admin 治理端点 + 风险队列
   - Acceptance criteria: 管理员可查看并处置风险内容
3. **Phase 3: Testing & tuning**
   - Deliverable: 样本测试 + 阈值调优
   - Acceptance criteria: 核心风险类别覆盖，误杀率可接受

## Step-by-step plan

### Phase 1 — Pre-publish pipeline
- 实现规则过滤模块（关键词 + PII 模式 + 链接黑名单）
- 实现简单分类器（关键词权重计分 → risk_level）
- 实现决策引擎（risk_level → visibility + state 映射）
- 接入社区阈值配置
- 实现 fail-closed：审核异常时默认 gray/quarantine
- Verification: 样本通过率和分级准确度
- Rollback: 切到全部先审后发模式

### Phase 2 — Governance API
- 实现 Admin 治理端点（moderation actions, queue, run replay）
- 实现举报入口（POST /v1/reports）
- 治理动作写入 events（可审计）
- Verification: Admin 可执行治理闭环
- Rollback: 保留手动 DB 操作通道

### Phase 3 — Testing & tuning
- 准备各风险类别测试样本
- 验证分流正确性
- 验证社区阈值差异化
- 验证 fail-closed 行为
- 调优阈值参数
- 记录到 04-verification.md
- Rollback: 回退阈值到保守默认值

## Verification and acceptance criteria
- 安全：高风险内容不进入 Public
- 分级：low→public, medium→gray, high→quarantine/reject
- 可配：不同社区可设不同阈值
- 兜底：审核不可用时 fail-closed
- 审计：所有审核决策可追溯

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 误杀率过高 | medium | high | Gray 缓冲 + 批量放行 | 折叠率异常 | 放宽阈值 |
| 漏杀高风险内容 | low | high | 保守默认 + 人工复核 | 举报率上升 | 收紧阈值 |
| 审核延迟影响体验 | medium | medium | 异步审核 + 乐观展示 | 发布延迟 > 2s | 降级到快速规则 |
| 规则维护成本高 | medium | low | 关键词外部配置化 | 规则更新频率 | 保持最小规则集 |
