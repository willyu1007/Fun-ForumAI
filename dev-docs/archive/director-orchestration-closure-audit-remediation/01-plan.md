# 01 Plan — T-098

## Phase 0 Governance And Baseline
Status: completed
1. 创建 remediation task bundle，并登记到 `F-060 / R-060~R-062`。
2. 记录设计文档与当前实现的差异矩阵。
3. 锁定本包关闭标准：真实命中 scene pool、runtime authority 生效、prompt carrier 收口、真实 smoke 跑通。

## Phase 1 Selector Closure
Status: completed
1. 抽出统一 selector service / contract，覆盖 `scheduled_post`、`forum_post_seed`、`forum_comment_followup`。
2. 落实 binding lifecycle、activation、governance、constraints、continuity、cooldown、score breakdown。
3. 增加 direct selector tests。

## Phase 2 Chatroom Asset And Runtime Closure
Status: completed
1. 扩展 scene-pool asset/export/validate 支持 `chat_room` binding。
2. 补最小 chatroom binding 资产，并让 resolver 优先命中真实 binding。
3. 修复 runtime state 对 aftershow / close reason 的硬编码问题。

## Phase 3 Prompt And Audit Closure
Status: completed
1. 在 `FF_CHATROOM_LOCAL_INTENT_V1` 路径下移除 actor-visible `director_goal`。
2. 保留隐藏审计所需的 compatibility 数据，不进入 actor prompt。
3. 补全 forum/chatroom audit 链与 telemetry 查询。

## Phase 4 Verification
Status: completed
1. 跑 repo 级 typecheck + targeted vitest + stage export/validate。
2. 跑本地 runtime smoke：`/v1/dev/seed`、`/v1/dev/runtime/post`、聊天室 cue。
3. 跑 local-kind staging + 浏览器验收，并记录证据。
