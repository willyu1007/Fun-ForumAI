# 00 Overview — forum-semantic-convergence-governance-program (T-142)

## Status

- State: done
- Depends on: discussion baseline `/Users/phoenix/Downloads/forum_semantic_convergence_plan.md`, archived launch packaging tasks `T-133` to `T-141`, active execution baselines `T-915`, `T-924`, `T-925`, `T-926`, `T-927`
- Next step: none; `T-142` closeout is complete and future work should treat this bundle as the authoritative handoff record for the frozen wave-1 semantics and review chain.

## Goal

建立“Forum 语义收敛与治理同步”的总控任务包，作为本轮跨 community/content/governance/agent/search/analytics 的 authoritative coordination layer，锁定术语、边界、依赖顺序、验收口径和 compat 删除顺序。

## Non-goals

- 不在本总控包内直接实现 schema、API、前端页面或搜索索引变更。
- 不把现有 `agent-social-bio` 任务链重新编号或重开为新任务。
- 不引入 agent 简介自由编辑能力；简介仍保持自动生成。

## Locked Decisions

- 社区/内容/展示全部去 `T4` 主命名；`T*` 仅允许保留在治理轴迁移期。
- 社区核心轴固定为 `community_family`、`public_participation_mode`、`publication_review_profile_id`。
- 社区交互合同固定为三轴：
  - `public_participation_mode`
  - `audience_signal_ingestion`
  - `agent_human_response_mode`
- `community_shell_category` 冻结为 `theme | show | world | creator`。
- `community_family` 第一波冻结为 12 个真值：
  - `conflict_arena`
  - `relationship_jury`
  - `persona_drama`
  - `values_debate`
  - `postmortem_lab`
  - `banter_observer`
  - `night_companion`
  - `story_episode`
  - `creator_recommendation`
  - `creator_relationship`
  - `weekly_program`
  - `limited_event`
- 第一波不引入 `community_subtype`；更细 creator 细分留给后续 second-wave taxonomy。
- `creator_note` 退回内容/模板命名空间，不再作为 community family。
- `launch_phase` 迁移为 `launch_wave`。
- `open_reply` 作为一等语义保留在 shared contract，但真正 governance/forum gate 启用留给 `T-144`。
- 五条状态轴必须分离：
  - `scene_phase`
  - `storyline_state`
  - `community_lifecycle_state`
  - `launch_wave`
  - `editorial_shelf_id`
- agent 对外资料拆为 `public_identity / public_projection / public_proof`；bio 生成链继续复用现有能力。
- 本轮默认 canonical naming 已锁定：
  - `notes_today`
  - `note_root_card`
  - `authoring_shapes`
  - `creator_note_policy`
  - `creator_note_templates`
  - `global_note_contract`
  - `incubation_visibility_mode`
- 高频裸词整治纳入本轮主计划，但范围仅限论坛主链的 `community / content / governance / agent / search / analytics`。

## Program Structure

- `T-143`: shared taxonomy、config contract、loader/normalizer、status-axis ownership、canonical semantic spine 与 dual-output compatibility
- `T-144`: proposal/incubation/admin governance 与三轴交互合同切换
- `T-145`: agent public DTO 与 surface 语义分层，和现有 bio 生成链完成边界收口
- `T-146`: search / analytics / semantic field inventory / compat cleanup / backfill / rollback 收口

## Active Implementation Gates

- `T-144` 的 hard gate 不只是命名切换，还必须交付 human-authored main-thread 兼容：
  - `PublicStageThread / PublicStageTurn` polymorphic author model
  - mixed agent/human read model 不崩
  - human-authored main-thread entry 不会打断 search refresh
- `T-144` handoff contract 必须包含：
  - human author model
  - canonical governance payload matrix
  - legacy governance mapping table
  - search-safe compatibility note
- `T-145` handoff contract 必须包含：
  - surface read-source matrix
  - `display_badges` / flat `tagline` / flat `public_bio` 的 derived-compat 规则
- `T-146` 不得在下列事项未 review 签收前启动：
  - `T-144` 的 human-author 主 thread 兼容和 legacy governance 退场
  - `T-145` 的 split contract 读模型和 surface read-source matrix

## Requirement Coverage Matrix

- 第 5 章 `T4` 伪命名空间问题、拆法与避坑由 `T-142` 锁定命名宪法与边界，`T-143` 负责把 source config / loader / runtime 主路径切到 canonical naming。
- 第 6 章作者标签混读问题由 `T-142` 锁定 identity/projection/proof 分层原则，`T-145` 负责 public identity 合同、读取源与 compat fallback 收口。
- 第 7 章内容包装五层模型、`allowed_content_shapes / content_kind`、`editorial_shelf`、模板 alias 与状态边界由 `T-143` 负责 shared spine 与 canonical config，`T-146` 负责 search / analytics / UI cleanup 跟进。
- 文档第 8 章 community taxonomy 由 `T-143` 负责定义 canonical family / shell category / publication review profile，由 `T-146` 负责删除前端猜分类主路径。
- 第 9 章 public participation 由 `T-143` 定 shared contract，`T-144` 负责 proposal/incubation/admin/forum gate cutover。
- 第 10 章五条状态轴由 `T-143` 定 shared type 和 projection boundary，`T-146` 负责索引和事件层传播。
- 第 11 章高频裸词命名宪法由 `T-142` 定规则，`T-143/T-145/T-146` 在各自 touched surface 落地。
- 第 12 章 governance split 由 `T-144` 完成。
- 第 15 至 16 章目标模型和系统分层由 `T-143/T-144/T-145/T-146` 分工实现。
- 第 17 章 migration path 和 compat 删除顺序由 `T-142` 总控，`T-146` 负责收口执行。
- 第 20 章验收标准由 `T-142` 总控成 pack-level review gate 和 final program closeout，`T-143` 至 `T-146` 分别提供代码、测试、迁移与 compat 证据。
- 第 21 章未决问题在本轮被收敛为 wave-1 freeze：
  - `creator_note` 保留在内容/模板命名空间，不作为 family
  - 不引入 wave-1 `community_subtype`
  - `launch_phase -> launch_wave`
  - `notes_today` 作为首页 creator-note shelf canonical id
  - `is_t4` 仅允许作为兼容只读字段，不再作为主路径真值

## Acceptance Criteria

- [x] `M-030 > F-100 > R-101~R-105 > T-142~T-146` 的 project mapping 已建立并通过 governance sync/lint。
- [x] 五个任务包的职责、输入输出、依赖顺序、非目标和验收标准已写清，不给后续实现者留二次决策空洞。
- [x] 已形成“需求文档条款 -> 任务包责任 -> 验收项”的母表，后续实现无需再次回读讨论上下文才能判断 owner。
- [x] 每个 child pack 都定义了进入下一包前必须完成的 review gate、handoff contract 和 unresolved-item closeout 规则。
- [x] 与现有 `T-924/T-925/T-926/T-927` 的边界已显式记录，避免重复实现 bio 生成底层能力。
- [x] 已明确 `T-927` 仅负责 bio public/search rollout 机制；`T-146` 负责跨域 semantic backfill、reason-code vocabulary 与 compat cleanup。
- [x] compat 删除策略已锁定为“ingress 兼容、canonical 主路径、legacy 输出延后到 T-146 删除”，且每个 child pack 都有明确的 cutover/explainability/backfill 责任。
- [x] program-level 验收明确包含：
  - API 不再要求前端猜社区分类
  - 运行时不再返回中文 shelf label 作为数据值
  - 搜索命中理由与用户可见 chip 一致
- [x] 完成 `T-146` review 后，`T-142` 能输出一份整包回顾，确认实施顺序、依赖、风险和验收链条可执行且无关键遗漏。
- [x] 任何后续实现都可直接依据 `T-143` 至 `T-146` 的 bundle 开工，而不需要重新回看本轮讨论记录。

## Final Closeout

- 执行顺序已在仓库实现中成立：
  - `T-143` 先冻结 shared taxonomy / contract spine
  - `T-144` 与 `T-145` 在同一 frozen contract 上完成治理链和 public identity 分层
  - `T-146` 在两者 review 完成后完成 search / analytics / compat cleanup
  - 当前 `T-142` 负责最终 readback、依赖确认和 closeout
- 与需求文档的当前 wave-1 差异已明确记录为 deliberate divergence，而不是 implementation drift：
  - `creator_note` 仅保留在内容/模板命名空间
  - 不引入 wave-1 `community_subtype`
  - `notes_today` 作为 creator-note shelf canonical id
  - `launch_wave` 取代 `launch_phase`
- 本轮 corrective pass 已把 raw launch source config 切到 canonical-first：
  - `community_family`
  - `launch_wave`
  - `default_editorial_shelf_ids`
  - `authoring_shapes`
  - `creator_note_policy`
  - `publication_review_profile_id`
  - `proposed_community_family`
  - `incubation_visibility_mode`
  - `identity_role_id`
  - `identity_visibility_role_id`
  - `format_capabilities`
- 剩余 legacy DB/API 字段仅作为显式 compatibility surface 保留：
  - `is_t4`
  - `display_badges`
  - `match_reason_codes`
  - `recommended_visibility`
  - launch/runtime alias ingress (`community_type`, `launch_phase`, `t4_today`, `t4_blogger`) 仅允许停留在 loader normalizer，不再是 repo SSOT
- 最终 closeout 结论：
  - downstream owner 未变化
  - review gate 无冲突
  - migration / rollback / compat 删除顺序可执行
  - 没有未决语义问题被推给下游包
