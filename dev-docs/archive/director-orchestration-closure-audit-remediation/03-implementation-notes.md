# 03 Implementation Notes — T-098

- 2026-03-14 创建 remediation bundle，承接 `T-094 ~ T-096` 的跨包闭环修复。
- 已确认的实现缺口：
  - selector 只有 `scheduled_post` 最小实现，且 filter/score/audit 明显缩水；
  - scene pool 导出没有 `chat_room` binding；
  - chatroom actor prompt 仍暴露 `director_goal` compatibility carrier；
  - runtime authority 对 aftershow/close reason 仍存在硬编码与命名漂移；
  - 指标/实验/rubric 缺少可执行验证链。
- 2026-03-14 remediation closeout：
  - selector 已扩为统一入口，覆盖 `scheduled_post`、`forum_post_seed`、`forum_comment_followup`，并落地 hard filter / score breakdown / fallback audit；
  - scene pool 已支持 `chat_room` binding，`launch.json` 中存在真实 chatroom binding，resolver 不再把 legacy fallback 当常态；
  - runtime authority 已真实消费 `aftershow_mode`，并统一 close reason 到 `threshold` 口径；
  - `FF_CHATROOM_LOCAL_INTENT_V1` 下 actor-visible chatroom prompt 已切到 `LocalIntent`，compat goal 仅保留在 hidden audit；
  - 增加只读 closure report、rubric sheet、浏览器验收与 local-kind staging rehearsal 作为关闭证据。

## Open follow-up actions
- 无阻塞本包关闭的 task-local follow-up。
- 剩余 `editorial overlay` 资产缺口已在 `00-overview.md` 标记为 backlog omission，不在本包继续展开。
