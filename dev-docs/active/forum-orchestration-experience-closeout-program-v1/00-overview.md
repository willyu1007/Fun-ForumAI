# 00 Overview — forum-orchestration-experience-closeout-program-v1 (T-946)

## Status

- State: done
- Depends on: `T-915 search-correctness-convergence-and-discovery-hardening-v1`, `T-941 forum-semantic-lifecycle-projection-foundation-v1`, `T-943 forum-participation-contract-and-viewer-write-plane-v1`, `T-945 forum-semantic-llm-runtime-convergence-v2`, `/Users/yurui/Downloads/forum_code_alignment_review_report.md`, `/Users/yurui/Downloads/forum_remediation_task_backlog.md`
- Current status: program closeout is complete. Integrated acceptance index, compat/deprecation timeline, and anti-drift checklist are recorded, and Gate 4 evidence is archived in the package.
- Next step: downstream work should use the closeout checklist as the guardrail for any future forum/runtime/search/doc changes.

## Goal

建立“Forum 编排与体验闭环整改”的 authoritative coordination layer，使所有真实问题和真实风险都能被唯一 owner task 消费，并按四层顺序收口：

- 基础语义与统一写平面
- 导演自然度与观看体验
- 读模型/搜索热路径与顶层叙事文档
- 集成验收、兼容退场与长期反漂移

## Non-goals

- 不在本总控包内直接实现产品代码或数据库变更。
- 不为了迎合旧报告而重做已经落地且仍有效的 context/openapi/glossary 基础层。
- 不把 `T-941`、`T-942`、`T-944` 重新改造成杂项整改包。

## Locked decisions

- 任务模型固定为“总控包 + 复用子包 + 新建缺口子包”，不另起平行整改工程。
- Phase 1 固定包含 `T-941 + T-945 + T-943` 的基础语义收口。
- Phase 2 固定包含 `T-947 + T-942` 的导演/观看体验收口。
- Phase 3 固定包含 `T-948 + T-915 consumer closeout + T-949` 的热路径与文档收口。
- Phase 4 由 `T-946` 负责集成验收、兼容退场与反漂移治理收口。
- 不新增 public API version。
- `/viewer/*` 保持 canonical viewer-facing public write contract；legacy public write routes 只保留兼容壳。
- `selected_anchor_turn_id`、`actual_anchor_turn_id`、`quoted_excerpt`、`source_context` 继续作为唯一公开语义主链，不再发明并行字段。
- `T-941` 继续作为 shared contract / projection 语义护栏；`T-942` 只承接小幅前端适配与手动 UX 验收。

## Program structure

- `T-945 forum-semantic-llm-runtime-convergence-v2`
  - owner: event target / perceived focus / write anchor 三分语义、selected-anchor 写回闭环、legacy flatten anchor 语义污染清理
- `T-943 forum-participation-contract-and-viewer-write-plane-v1`
  - owner: canonical viewer write plane、legacy/compat route 收口、accepted write fanout parity
- `T-941 forum-semantic-lifecycle-projection-foundation-v1`
  - owner: lifecycle snapshot 标准读模型字段、lifecycle 驱动可写性/收束、route/lifecycle 事件消费契约、projection version guardrail
- `T-947 forum-attention-and-recall-hardening-v1`
  - owner: broker 真正消费 forest/local structure、recall scope/decay、生效 telemetry
- `T-942 forum-post-detail-discussion-forest-v1`
  - owner: discussion forest 主观看体验、late-entry 视觉插位、projection 字段前端消费、人类沿点回复 UX
- `T-948 forum-read-model-and-search-projection-slimming-v1`
  - owner: forum/search/runtime 高频读路径瘦身、summary-first / bounded-window / projection-first 收口、projection cache/versioning、search projection payload strengthening
- `T-915 search-correctness-convergence-and-discovery-hardening-v1`
  - owner: 消费 `T-948` 的 lean bundles，完成 search-side regression / reconcile / health closeout
- `T-949 forum-product-narrative-and-context-alignment-v1`
  - owner: 顶层叙事、context entry docs、overview/PRD/onboarding 文档与真实系统世界观对齐
- `T-946 forum-orchestration-experience-closeout-program-v1`
  - owner: adjudication matrix、跨包集成验收、兼容退场计划、长期反漂移 checklist 与术语守卫

## Acceptance Criteria

- [x] 外部报告中的每个真实问题，以及本轮 repo inspection 发现的新增真实风险，都在 adjudication matrix 中有唯一 disposition、owner task 和验证条目。
- [x] `T-943`、`T-945`、`T-915` 的 bundle 已重写为本次 program 定义的 owner 边界，不再各自含混承担读模型、导演策略或文档整改。
- [x] `T-941` 与 `T-942` 也已被纳入本次 program 的显式 owner 结构，不再只是隐含依赖。
- [x] Phase 1 的 Gate 1 明确要求并覆盖：
  - agent branch revive 写回锚点闭环
  - viewer accepted write 与 agent write 的 side-effect parity
  - lifecycle snapshot / route handoff / writeability 语义在 read/runtime/write 三侧一致
- [x] Phase 2 的 Gate 2 明确要求并覆盖：
  - recall suppression 不再跨 thread 误杀
  - discussion forest 不再以 thread-card 为主观感
  - 人类沿点回复与 agent 晚到插位在 UX 上成立
- [x] Phase 3 的 Gate 3 明确要求并覆盖：
  - forum/search/runtime 热路径不再默认依赖全量 thread hydration
  - 顶层现行文档不再传播 “LLM-only public participation” 叙事
  - 所有搜索消费路径不再逐条回读完整 thread detail
- [x] Phase 4 的 Gate 4 明确要求并覆盖：
  - forest / lifecycle / search / contract 跨模块集成验收集存在且可复跑
  - legacy 路径、兼容期与退场节奏有明确计划
  - 反漂移 checklist / 术语守卫已落地并绑定到后续评审
- [x] program closeout 时，不需要实现者重新回看本轮聊天记录，也能知道各子包的责任边界、依赖顺序和验收口径。
- [x] remediation backlog 的 `TSK-001` 到 `TSK-040` 全量条目都在本 program 中有显式 owner；不存在 orphan item。
