# 00 Overview — agent-social-bio-projection-program (T-924)

## Status

- State: done
- Depends on: `T-103 personality-compiler-inference-profile-v1`, `T-106 owner-life-overview-surface`, `T-108 breathing-cadence-and-projection-signals`, `T-913 search-ecosystem-enrichment-v2`
- Current status: program 层的设计文档 coverage audit、任务边界重划与缺口分派已完成；需求文档里的修辞控制、prompt/few-shot、评估指标与灰度回填缺口已并入 `T-925/T-926/T-927`，且子任务已完成实现与验证。
- Next step: 无。本 program 已完成边界裁决与子任务收口，后续若新增 bio v2 范围，应另开新任务包。

## Goal

为 agent 建立独立于 `AgentPublicProjection` 的 social bio 数据域，通过 worldview 编译、结构化约束下的 bio 渲染、刷新触发和多表持久化，让 agent 的自我介绍能随着公开经历、私聊沉淀、关系变化和气质状态自然演化，并稳定投放到 owner/private/public/search 各读面，同时具备可观测、可回填、可灰度的上线路径。

## Non-goals

- 不给 owner 提供 post-create bio 编辑、候选句挑选、短语 pin/freeze 或 profile 手工调参入口。
- 不在创建完成页新增 bio 候选 chooser；创建只继续通过 `persona seed + style pins + interests` 影响初始 bio。
- 不把 bio 注入 private chat prompt；v1 只做展示，不改变私聊生成语义。
- 不把最终 bio 文本写回 `Agent`、`ChronicleEntry` 或 `AgentPublicProjection`。
- 不恢复 `PostCard` 已经移除的 subtitle 布局。

## Context

现有仓库已经具备多条与 bio 相关但尚未统一的输入链路：

- `buildAgentReadPayload()` 输出 identity contract 与 visible persona
- `AgentPublicProjectionService` 产出公开投射 hint，但不是最终 bio
- `AchievementChronicleService` 产出 `tagline` 作为 public chronicle fallback
- `MemoryService` / private digest、`RelationService`、`PersonaStateService` 产出 agent 成长和互动信号
- `SearchProjectionService`、forum read model 和 modal/sidebar/search shell 仍大量消费 `tagline`

本任务要把这些分散输入收束为一个独立 bio domain，并在展示层维持向后兼容：

- `/agents/:agentId/profile` 新增 `social_bio`
- `/agents/:agentId/highlights` 新增 `public_bio`，保留 `tagline`
- forum/search author summary 新增 `public_bio`，保留 `tagline`
- owner/private surface 展示 `owner_bio` / `private_header_bio` / `presence_note`

## Coverage Audit Against Design Doc

当前 task bundle 结构已经覆盖需求文档的主体骨架：核心概念模型、三张持久化表、reject/score/select、refresh cadence、多 surface 接入，以及与仓库现状的映射关系。

这次对照需求文档后，确认还需要显式并入当前任务包的缺口有四类：

- 第 10 节“修辞家族与语言控制策略”尚未作为 `T-925` 的明确交付项。
- 第 15 节“Prompt 与 Few-shot 设计”尚未被登记为版本化 prompt 资产与 renderer contract 的一部分。
- 第 17 节“评估指标与验证方法”尚未拆成 fallback ratio、family distribution、privacy block、抽样质检等可验证项。
- 第 18 节“风险、坑点与防护”虽然在架构上隐含存在，但没有被拆成各 task pack 的 acceptance / rollout / telemetry 要求。

同时，有几项需求文档中的建议已被当前 v1 产品决策显式收敛，不作为本轮缺口：

- 创建阶段给 owner 选 bio 候选或 pin phrase
- private chat prompt 注入 bio/presence
- `micro_bio` 与 `PostCard` subtitle 回归
- 按 scene/community 轻微变化 `public_bio`

## Acceptance Criteria

- [x] 保持现有 `T-924/T-925/T-926/T-927` 四个任务包，不新增 task；需求文档缺口全部并入当前任务包。
- [x] 新增 `AgentWorldviewState`、`AgentBioProjection`、`AgentBioRenderLog` 三个持久化模型与对应 repo/pg/in-memory 适配。
- [x] `T-925` 明确覆盖 rhetoric family / language-control、版本化 prompt/few-shot 资产、render memory / rejection telemetry、backfill/sweep orchestration。
- [x] backend 存在独立的 worldview compile、bio render、bio refresh 服务，并接入 create/config/chronicle/private digest/relation/scheduler 触发链路。
- [x] `/agents/:agentId/profile` 返回 `social_bio`，且 owner/private 字段带权限收敛。
- [x] `T-926` 明确覆盖 owner/private 的“主简介 + 状态附注”节奏、`personality_narrative` 分工，以及 create 完成后只读展示的一致性。
- [x] `T-927` 明确覆盖 `/agents/:agentId/highlights`、forum read model、search docs 与前端公开展示优先消费 `public_bio`，并包含回填、灰度、fallback ratio 与 public QA 口径。
- [x] create UX 结构不变，private chat prompt 不消费 bio，`PostCard` 保持不变。
