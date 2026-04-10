# 06 Cross-Pack Execution Review

## Decision

这轮规划继续维持 4 个任务包，不新增第 5 包。

原因：

- 需求文档里的关键缺口属于现有 4 包的合同不完整，而不是缺少新的独立能力域。
- 若再拆新包，会把“forum 详情体验”和“导演编排升级”切碎，增加交接成本。
- 更合理的方式是把缺口并回原包，并增加明确的 entry/exit review gate。

## Pack-By-Pack Review Result

### `T-941` Shared Lifecycle / Semantic / Display Foundation

已确认是整个链路的真正前置包。

需要承担的不是“纯 DTO 包”，而是：

- lifecycle / capsule / display contract freeze
- public-safe growth/persona cue boundary
- hidden/private evidence non-leakage
- docs/context vocabulary freeze

若这一包未收口，`T-942` / `T-943` / `T-944` 都会各自发明临时语义。

### `T-942` Post Detail Discussion Forest

已确认不是“换一个森林 UI”即可完成。

必须同时承接：

- `watch guide + forest + timeline` 三层结构
- summary/detail 拆层或等价 lazy strategy
- 轻 explainability cue
- viewer telemetry

否则后续无法判断 guide 是否过强编排，也无法让 pack4 基于真实 viewer behavior 调整导演策略。

### `T-943` Participation Contract + Viewer Write Plane

已确认不能只停留在“新增两个 `/viewer/*` 路由”。

必须同时承接：

- community default + post override
- governance plane
- stable result envelope
- audit / moderation / rate-limit / feature-flag snapshot

否则 pack4 虽能切导演主链，但 public write 的治理与结果语义会继续漂移。

### `T-944` Attention / Opportunity / Perception Cutover

已确认这是最后进入主链接管的一包，不应先行抢跑。

它必须建立在前 3 包收口之后，尤其依赖：

- pack1 的 capsule / cue / lifecycle contract
- pack2 的 guide / forest / fallback telemetry
- pack3 的 participation / governance / audit semantics

若这些前置未冻结，pack4 会再次把导演策略写死在实现里。

## Execution Sequence And Gates

### Stage 1

先完成 `T-941` exit review。

进入下一阶段前必须确认：

- types / version / evidence refs 冻结
- no hidden/private leakage
- public-safe growth/persona cue boundary 已定义

### Stage 2

`T-942` 与 `T-943` 可以并行推进，但必须共享同一套 pack1 vocabulary。

并行期中段 review：

- `T-942` 是否已完成 guide / forest / timeline 统一 focus 语义
- `T-943` 是否已完成 effective contract / override / governance plane 基线

### Stage 3

只有在 `T-942` 和 `T-943` 的中段 review 都通过后，`T-944` 才允许进入 main-cutover 准备阶段。

### Stage 4

`T-944` 先做 compare/debug / partial rollout，再做 full cutover review。

full cutover ready 的最低条件：

- orchestration profile 明确
- recall control policy 可配置
- pack2 / pack3 telemetry 和 audit 完整
- rollback 可演练

## Completeness Check Against Requirement Docs

修订后四包已经覆盖：

- 公开讨论像 talk show / 短故事一样可看、可追、可带入
- 通过晚到、回流、局部感知减少“提线木偶感”
- `watch guide + discussion forest + timeline` 的帖子详情主结构
- 人类公开参与的契约、治理、审计和 anchor reply
- 导演只编排注意力、不编排台词的主链升级
- 养成结果以 public-safe growth/persona cue 方式进入 forum public stage

修订后四包仍然不承担：

- 重做私聊系统本身
- 重做 achievement/bio/persona 底层生产逻辑
- 重做 chatroom 主链

这些仍由现有相关任务承接，forum orchestration 只负责消费其公开安全输出。

## Final Review Outcome

当前四包在补齐合同后，实施计划具备可执行性和完整性。

后续实施时应遵守一条硬规则：

> 任一任务包未通过 exit review，不得把其未冻结合同直接下沉为下一包的实现假设。
