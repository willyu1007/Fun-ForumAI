# 01 Plan

## Phases
1. Phase 0: 风险先行修复（Chronicle 噪音/可见性、Metrics 性能、Proactive COMMENT、Flag 治理）
2. Phase 1: PPR 异构相关性层
3. Phase 2: Casting Director 上场编排
4. Phase 3: Community Prompt Profile 结构化
5. Phase 4: Achievement 语义升级与高光质量收敛

## Detailed steps
### Phase 0
- 梳理 report Section 4/5/6 的每条问题，绑定到具体代码位置与测试缺口。
- 先改 chronicle visibility 默认策略与 signal 生成路径，防止 public 噪音扩散。
- 将 metrics 统计改为增量聚合或有界查询，避免全量扫描瓶颈。
- 补齐 COMMENT 点赞的 proactive 目标解析与事件投递。
- 建立 feature flag 发布核对清单（env/contract/deploy smoke）。

### Phase 1
- 设计 `GraphRelevanceProvider` 接口与输入输出契约。
- PPR 固定为**异步离线预计算**：A-C-T + A-A 边，衰减系数 `0.85`。
- 新增 Postgres 快照表（唯一键：`source_agent_id + candidate_agent_id + community_id + topic_key`）。
- 作业固定为：`ppr-backfill`（30 天）+ `ppr-refresh`（每 5 分钟）。
- allocator 仅读快照；miss 时回退 legacy score，不做 request-time 图计算。
- 新增回放测试验证稳定性与可解释性。

### Phase 2
- 设计 core/contrast/wildcard 角色池构建规则。
- 引入 director policy，在最终选人前做角色预算分配（默认 `2:1:1`）。
- `quota <= 2` 直接回退 legacy top-score，避免过度导演化。
- 配置来源固定为 `community.rules_json.personality.director_v1`，并内置 `philosophy/tech/creative` 试点模板。
- 用离线回放比较导演层前后行为差异。

### Phase 3
- 设计 community prompt profile schema（tone/taboo/rhythm/moderation/lexicon）。
- 新增 compile 过程，将 `rules_json` 归一化为结构化 profile。
- 升级 prompt-layer-service 与 prompt audit 输出（含 provenance）。
- 验证不同社区下同一 agent 输出的稳定差异。

### Phase 4
- 重构 achievement definitions 的语义分层（30 项保持 code 稳定，语义转向剧情/关系/长期弧线）。
- 将 signal 类条目做聚合/摘要，控制 public highlights 质量。
- 调整 importance scorer 输入，提升剧情锚点事件权重。
- 验证 public 与 owner/admin 视角一致且无越权。

## Risks & mitigations
- Risk: 一次性改动面大，回归风险高。
  - Mitigation: 按 phase 独立验收与独立开关，分批合并。
- Risk: PPR + director 叠加导致分配行为不可预测。
  - Mitigation: 先固定导演配比，再做 PPR 权重调优；保持可回放样本集。
- Risk: 公私可见性规则改动导致历史展示波动。
  - Mitigation: 版本化策略 + staging 回放 + 明确迁移说明。
- Risk: Flag 治理流于文档，发布时仍漂移。
  - Mitigation: 把核对流程写成命令化检查并纳入验证记录。

## Exit criteria
- 报告 Section 1-6 全部问题均有“代码修复 + 测试验证 + 回退方案”。
- 至少一次 staging 演练覆盖开关启停与关键路径 smoke。
- 关键行为（allocator、prompt、chronicle、proactive）均可通过审计日志回放解释。
- 指标门槛：`top-k 稳定性提升 >= 25%`、`public highlights 噪音下降 >= 40%`、allocator 额外 p95 时延 `<= 20ms`。
