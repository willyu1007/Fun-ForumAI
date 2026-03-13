# 05 Pitfalls — T-095

## Do-not-repeat summary
- 不要让 `SceneSelector` 退化成“先随机选社区，再给结果找 scene 标签”。
- 不要让 `EpisodeBrief` 变成角色 prompt 的直接输入。
- 不要只给 `scheduled_post` 补 metadata 却不保留 selection/planning audit。

## Historical log
- 2026-03-13
  - symptom: `scheduled_post` 现有实现即使引入 selector，也可能继续被 parser/LLM 通过 JSON 中的 `community_id_or_slug` 暗中改写 target。
  - root cause: 当前 `ResponseParser.parseAsScheduledPost()` 仍把模型输出的社区字段当作可接受输入，而旧链路本身先随机社区、再让模型补结构。
  - what was tried: 评估是否保留“模型可建议 target”以增加灵活性；结论是不应保留，因为这会直接削弱 selector 作为 authority 的意义。
  - fix/workaround: 在合同中明确 target community 由 selector/binding authority 决定，parser 只能做一致性校验，不得改写。
  - prevention note: 后续任何 scheduled_post 相关 schema/parse 逻辑，只要允许模型改写 target，都应视为 contract violation。
- 2026-03-13
  - symptom: forum comment 如果每次都重新 full pool search，会把同一 thread 的 continuity 打散。
  - root cause: comment 链路天然 anchored 到 `post_id/comment_id`，但如果 selector 不显式区分 `forum_comment_followup`，实现侧会倾向复用与 scheduled_post 相同的 full search 流。
  - what was tried: 对比现有 `AgentExecutor/ResponseParser` 的锚定方式，确认 comment followup 更像 episode continuation，而不是新节目开场。
  - fix/workaround: 在合同里加入 `forum_comment_followup` entry kind，并默认 follow existing episode；仅在 metadata 缺失或 continuity 失效时才重选。
  - prevention note: forum comment 任何想直接复用 scheduled_post selector 的实现，都应先证明不会破坏 thread-level continuity。
- 2026-03-13
  - symptom: 很容易把 `Post.moderation_metadata` 当成现成的 `scene_metadata` 落点，从而省掉 dedicated content carrier。
  - root cause: repo 当前事件和 agent run 都有通用 JSON，但 post/comment 没有专门的 scene metadata 字段，最顺手的现存字段就是 moderation metadata。
  - what was tried: 对照 `forum-write-service`、`repos/types/forum.ts` 和 Prisma schema 检查现有 carrier；结论是 moderation metadata 只适合治理/分发标签，不适合作为 continuity SoT。
  - fix/workaround: 在合同中把 `trigger event.payload_json`、`agent_run.output_json`、content-level `scene_metadata` 拆成三层，并显式禁止把 `moderation_metadata_json` 升格为长期 `scene_metadata` SoT。
  - prevention note: 后续如果实现侧想复用 moderation metadata，必须先证明其字段生命周期、公开性和 continuity 语义都与 scene metadata 一致；默认视为 contract violation。
- 2026-03-13
  - symptom: 另一条常见捷径是给 `posts` 和 `comments` 各自补一个 `scene_metadata_json`，看似省掉 side-table，实际上把 continuity 读写拆成两套不对称路径。
  - root cause: post/comment 当前 schema 和 repo contract 已经不对称，直接在内容表各自扩字段会把这种不对称固化到 selector continuity 查询里。
  - what was tried: 对照 `post-repository.ts`、`comment-repository.ts` 与 Prisma schema，评估“各加一个 JSON 列”是否真的更简单；结论是它只会把 thread continuity union 逻辑推给每个调用者。
  - fix/workaround: 在合同中冻结 forum-scoped `forum_scene_metadata` sidecar，并要求 comment 记录冗余携带 `post_id`，由单一 repo 负责按 post/episode 回收 continuity。
  - prevention note: 后续若有人提议 dual-column 方案，必须先证明 forum post/comment 的 continuity 读取不会产生两套查询分支；默认不接受。
