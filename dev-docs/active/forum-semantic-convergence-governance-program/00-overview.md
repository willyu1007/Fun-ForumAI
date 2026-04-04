# 00 Overview — forum-semantic-convergence-governance-program (T-142)

## Status

- State: in-progress
- Depends on: discussion baseline `/Users/phoenix/Downloads/forum_semantic_convergence_plan.md`, archived launch packaging tasks `T-133` to `T-141`, active execution baselines `T-915`, `T-924`, `T-925`, `T-926`, `T-927`
- Next step: keep `T-144` and `T-145` in lockstep with the frozen `T-143` contract, enforce the mixed-author review gate before `T-146`, and maintain the final closeout checklist as implementation evidence lands.

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

- 文档第 8 章 community taxonomy 由 `T-143` 负责定义 canonical family / shell category / publication review profile，由 `T-146` 负责删除前端猜分类主路径。
- 第 9 章 public participation 由 `T-143` 定 shared contract，`T-144` 负责 proposal/incubation/admin/forum gate cutover。
- 第 10 章五条状态轴由 `T-143` 定 shared type 和 projection boundary，`T-146` 负责索引和事件层传播。
- 第 11 章高频裸词命名宪法由 `T-142` 定规则，`T-143/T-145/T-146` 在各自 touched surface 落地。
- 第 12 章 governance split 由 `T-144` 完成。
- 第 15 至 16 章目标模型和系统分层由 `T-143/T-144/T-145/T-146` 分工实现。
- 第 17 章 migration path 和 compat 删除顺序由 `T-142` 总控，`T-146` 负责收口执行。

## Acceptance Criteria

- [ ] `M-030 > F-100 > R-101~R-105 > T-142~T-146` 的 project mapping 已建立并通过 governance sync/lint。
- [ ] 五个任务包的职责、输入输出、依赖顺序、非目标和验收标准已写清，不给后续实现者留二次决策空洞。
- [ ] 已形成“需求文档条款 -> 任务包责任 -> 验收项”的母表，后续实现无需再次回读讨论上下文才能判断 owner。
- [ ] 每个 child pack 都定义了进入下一包前必须完成的 review gate、handoff contract 和 unresolved-item closeout 规则。
- [ ] 与现有 `T-924/T-925/T-926/T-927` 的边界已显式记录，避免重复实现 bio 生成底层能力。
- [ ] 已明确 `T-927` 仅负责 bio public/search rollout 机制；`T-146` 负责跨域 semantic backfill、reason-code vocabulary 与 compat cleanup。
- [ ] compat 删除策略已锁定为“ingress 兼容、canonical 主路径、legacy 输出延后到 T-146 删除”，且每个 child pack 都有明确的 cutover/explainability/backfill 责任。
- [ ] program-level 验收明确包含：
  - API 不再要求前端猜社区分类
  - 运行时不再返回中文 shelf label 作为数据值
  - 搜索命中理由与用户可见 chip 一致
- [ ] 完成 `T-146` review 后，`T-142` 能输出一份整包回顾，确认实施顺序、依赖、风险和验收链条可执行且无关键遗漏。
- [ ] 任何后续实现都可直接依据 `T-143` 至 `T-146` 的 bundle 开工，而不需要重新回看本轮讨论记录。
