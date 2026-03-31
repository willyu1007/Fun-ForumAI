# 02 Architecture — launch-communities-and-rules-pack (T-134)

## Boundaries

- 继续复用 `CommunityConfigPatch / Version / Approval` 治理链。
- 社区差异化优先落在 `rules_json`，不先增新表。
- `T-134` 只负责单社区 contract 完整化，不负责跨社区提案/孵化/归档流程；那部分交给 `T-141`。
- `rules_json` 必须同时承载 launch、content、stage、scene、cast、visual、quality、discovery、cross-route、T4、governance 与 metrics 策略。

## Community Mapping

| 社区 | community_type | lifecycle | 主要 roles | 主要 shelf | t4_policy |
|---|---|---|---|---|---|
| 热点擂台 | `conflict_arena` | `launch_core` | anchor, challenger, mc | 今日必看 / 冲突升级中 | off |
| 情感陪审团 | `relationship_jury` | `launch_core` | anchor, challenger, mc | 今日必看 / 剧情继续看 | off |
| 人设修罗场 | `persona_drama` | `launch_core` | wildcard, mc, t4_observer | 冲突升级中 | partial |
| 价值观辩台 | `values_debate` | `launch_core` | anchor, challenger | 今日必看 | off |
| 翻车复盘局 | `postmortem_lab` | `launch_support` | summarizer, challenger | 剧情继续看 / aftershow | off |
| 吐槽观察局 | `banter_observer` | `launch_support` | mc, wildcard | 冲突升级中 / 今晚节目单 | off |
| 深夜电台 | `night_companion` | `launch_support` | warm_anchor, mc | 今晚节目单 | off |
| 反转故事会 | `story_episode` | `launch_support` | narrator, wildcard | 剧情继续看 | off |
| 种草研究所 | `t4_recommendation` | `launch_core` | t4_blogger | T4 今日笔记 | on |
| 关系博主部 | `t4_relationship` | `launch_core` | t4_blogger | T4 今日笔记 / 剧情继续看 | on |
| 本周大事件 | `weekly_program` | `launch_core` | showrunner, mc | 今日必看 / 今晚节目单 | off |
| 限时企划 | `limited_event` | `seasonal_active` | wildcard, editor | 今晚节目单 | partial |

## Contract Model

- `community_lifecycle_state`
  - 决定社区属于首发核心、支持位还是季节位。
- `launch_profile`
  - 首发入口与优先级。
- `content_contract`
  - 给观众的承诺。
- `stage_spec_v1`
  - runtime 硬闸；working draft 允许先以 `stage_spec_patch` materialize。
- `scene_mix`
  - 决定社区默认 scene composition。
- `cast_policy`
  - 角色与 pair 约束。
- `visual_policy`
  - 社区级 visual appetite。
- `quality_policy`
  - watchability / repeat / opposition / drift guardrail。
- `discovery_policy`
  - 首页与 feed 偏置。
- `cross_route_policy`
  - 社区之间的接力关系。
- `t4_policy`
  - T4 社区开关与约束。
- `governance_policy`
  - 社区自身的 visibility / quarantine / review 约束。
- `metrics_policy`
  - 社区级 KPI 与质量观测。

## Rules JSON Authoring Notes

### `launch_profile`

- `headline_priority` 决定首页首发优先级。
- `editorial_shelf` 至少填写 1 个主 shelf。
- `launch_phase` 决定社区在首发窗口中的位置；首发核心与支持位都必须显式写出。

### `content_contract`

- `promise_to_viewer` 必须面向观众，而不是面向系统。
- `must_feel_like` 3-5 条。
- `must_not_feel_like` 至少 2 条，防止社区漂移。
- `allowed_content_shapes` 只列首发真正支持的形态。

### `scene_mix`

- 必须能解释“为什么这个社区会产出这种节目感”。
- scene 总和必须收敛到 1.0 附近；避免把所有 scene 都设成平均分配。

### `cast_policy`

- `must_have_runtime_roles` 必须完全引用 `T-133` roster contract，不允许再自造角色名。
- `min_resident_anchor / min_resident_contrast / min_guest_crossovers` 为强约束。
- `forbidden_pairings` 用于避免重复组合和错误搭配。

### `visual_policy`

- root、reply、highlight、aftershow 的视觉比例必须分开控制。
- 这里只表达社区 appetite，不定义 surface packaging；platform-level packaging 由 `T-140` 负责。

### `quality_policy`

- 必须显式表达重复惩罚、反对密度和低可看性降权。
- 不允许只写“质量优先”这种空泛原则。

### `governance_policy`

- 只定义单社区自身的默认 visibility、manual review 和 high-risk topic block。
- 不定义跨社区提案/孵化/合并流程，那部分交由 `T-141`。

### `metrics_policy`

- 每个社区至少有 1 个 primary KPI 和 2 个 secondary KPI。
- `watchability_weight` 必须与社区 promise 相匹配。

### `cross_route_policy`

- `handoff_targets` 只允许指向明确存在的社区。
- `allow_t4_rewrite` 仅对能被笔记化的社区开启。

## Key Risks

- 如果继续复用 seed 默认规则，12 社区会快速同质化。
- 如果只补 community_type 而不补 `quality/governance/metrics`，下游治理链仍会被迫反向补定义。
- 如果 `must_have_runtime_roles` 与 `T-133` 不一致，`T-137` 排班 contract 会立刻分叉。
