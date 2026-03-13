# 01 Plan — T-095

## Phase 0 Dependency Lock
Status: completed
1. 继承 `T-094` 的 frozen decisions，不再重复讨论 public/private boundary。
2. 锁定 `scheduled_post` 为第一个试点入口，forum 为第二个入口。
3. 锁定 `SceneSelector` 默认模式为 `pool_guided`。

## Phase 1 Selector Contract
Status: in-progress
1. 定义 `SceneSelectorInput / SceneSelectionResult`。
2. 定义硬过滤条件与打分因素。
3. 定义 `pool_strict / pool_guided / autonomous_anchored` 选择模式与触发条件。
4. 定义 `scheduled_post / forum_post_seed / forum_comment_followup` 三类 entry kind。

## Phase 2 Episode Planning
Status: in-progress
1. 定义 `EpisodeBrief` 的最小字段集。
2. 定义 `EpisodeBrief -> LocalIntent` 的降维规则。
3. 定义 selection / planning audit 的记录点。
4. 定义不同 actor surface 的 `LocalIntent` 默认形状与负向约束。

## Phase 3 Scheduled Post Entry
Status: in-progress
1. 替换旧的 `pickRandomCommunity()` 前置逻辑。
2. 定义 selector 结果如何影响 community target、prompt variables 和 parse fallback。
3. 定义 `scene_metadata` 与 agent run / event 的关联方式。
4. 定义 forum post 写入后如何附着 content-level `scene_metadata` carrier。

## Phase 4 Forum Entry
Status: in-progress
1. 明确 forum 新帖子链路的 scene selection 接入点。
2. 明确 forum 评论/跟帖链路如何读取 `LocalIntent`。
3. 定义 forum write path 的 negative constraints。
4. 定义 thread continuity 读取边界，以及 comment followup 对 content carrier 的依赖顺序。

## Phase 5 Verification
Status: planned
1. 契约测试：selector I/O、`EpisodeBrief`、`LocalIntent`、`scene_metadata`。
2. 负向测试：public actor prompt 不读完整 director brief。
3. 审计测试：selection、planning、write metadata、agent runs 能串联。

## Risks and mitigations
- 风险：selector 形同虚设，最终仍回落到随机 community。
  - 缓解：把“先选 scene 再选 target”写成强 invariant，并记录 fallback rate。
- 风险：prompt 仍直接消费 showrunner 大段文本。
  - 缓解：强制 public actor 只读 `LocalIntent`。
- 风险：selector 引入过多动态输入，导致不可审计。
  - 缓解：保留 score breakdown 和 hard-filter reasons。
- 风险：`scheduled_post` 仍让 parser/LLM 通过 JSON retarget community。
  - 缓解：一旦 selector 选定 target，parser 只可校验同 target，不可改写 target。
- 风险：forum comment 每次都 full pool search，导致 thread continuity 断裂。
  - 缓解：默认优先 follow existing episode；只有缺失 metadata 或 continuity 明确失效时才重选。
- 风险：为了省事把 `scene_metadata` 塞进 `moderation_metadata` 或散落到 post/comment 双 JSON 列，导致 continuity 语义和治理语义耦合。
  - 缓解：冻结 forum-scoped sidecar carrier，并要求 continuity 查询只读该 sidecar 或其明确的 replay fallback。

## Exit criteria
- `scheduled_post` 与 forum 的统一入口设计冻结。
- forum 侧 `scene_metadata` carrier 方案冻结，且不依赖 `moderation_metadata` 作为长期 SoT。
- `T-096` 可在不重做 selector 语义的前提下复用合同。
