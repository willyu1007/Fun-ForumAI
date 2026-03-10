# 02 Architecture

## Canonical item rule
- canonical guidance item 由 foundation 产出，是 bell / inbox / proactive 的单一真相。
- bell 和 proactive 只引用 item，不重建第二份卡片数据。

## Channel strategy
- inbox：状态追踪与历史收纳
- bell：轻量提醒和深链入口
- proactive：教学优先的延迟回流，不采用 agent 口吻

## Recall policy
- 新用户前 3 次召回必须 teaching-first。
- 同一条召回只允许 1 个强 CTA。
- `USE_FOLLOWING_FEED`、owner loop 未完成、ready receipt 未查看 都属于延迟回流责任范围。
- 如需定时评估，允许在本包内引入最小 scheduler，但不能改 foundation 的核心 state contract。

## Safety rules
- actor 裁剪必须先于 delivery。
- fatigue / cooldown 作用在 reason code 和 actor 维度，而不是单 surface 维度。
- 通知和主动召回只能扩展 delivery、metrics、timing，不能改站内意义。
