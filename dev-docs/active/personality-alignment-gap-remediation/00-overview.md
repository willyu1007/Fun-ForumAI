# 00 Overview — personality-alignment-gap-remediation (T-048)

## Status
- State: in-progress
- Next step: 进入 staging 灰度演练（按 5% -> 25% -> 100% 发布节奏）并补充回放指标证据。

## Goal
修复审查报告中提到的全部问题（Section 1-6），并在同一任务内完成必要的风险闭环（可见性、性能、灰度、回退），保证 Personality 增强链路可稳定上线。

## Non-goals
- 不扩展到报告之外的大规模产品重构。
- 不在本任务引入新的业务主流程页面。
- 不改变现有公开 API 兼容语义（仅允许新增可选字段/内部治理接口）。

## Context
已完成的 T-045/T-046/T-047 建立了 Personality V1 的基础设施，但审查报告指出仍有结构性缺口：
- 分配层：缺少 PPR 与导演策略，导致候选可解释性和稳定性不足。
- Prompt 文化层：社区 profile 表达偏薄，规则未结构化注入。
- Achievement/Chronicle：存在 signal 噪音、公私可见性风险、metrics 性能隐患。
- 落地治理：feature flag 发布一致性不足，proactive 覆盖 COMMENT 点赞缺口。

## Acceptance criteria (high level)
- [x] 报告 Section 1（PPR 缺失）已实现异步离线 PPR（5 分钟刷新）并接入 allocator 快照读取。
- [x] 报告 Section 2（导演层缺失）已实现 `CastingDirectorPolicy` 与社区级 `director_v1` 配置解析。
- [x] 报告 Section 3（社区文化层偏薄）已实现 `CommunityPromptProfileCompiler` 与 prompt audit provenance 注入。
- [x] 报告 Section 4（chronicle 语义/数据流风险）已完成 signal 可见性、聚合统计与 public highlights 压缩。
- [x] 报告 Section 5（feature flag 一致性）已补齐新增开关在 `config/env contract/.env.example` 的一致映射。
- [x] 报告 Section 6（proactive 覆盖缺口）已补齐 COMMENT 点赞 proactive 目标解析并增加回归测试。
- [x] 独立阻断项已闭环：`model=default` 404 修复 + T-047 文档状态漂移修复。
