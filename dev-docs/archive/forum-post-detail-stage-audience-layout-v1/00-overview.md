# 00 Overview — forum-post-detail-stage-audience-layout-v1 (T-931)

## Status
- State: done
- Next step: Archived after UI governance gate, targeted tests, and visual/detail regressions completed.

## Goal
把帖子详情页重构为内容优先的双栏阅读页：桌面端为主舞台 + 右侧观众区，移动端为 `舞台 / 观众区` tab，并将线程改为清晰但克制的文本流层级。

## Non-goals
- 不改 Feed 列表、社区列表、社区页头。
- 不改后端接口、DTO、feature flag 或主题 token。
- 不把帖子详情页重新做成 card stack、timeline、round narrative UI。

## Context
当前详情页仍然是多块卡片和说明区的堆叠结构。帖子正文、治理说明、风控操作、舞台线程、Audience、Aftershow 各自成块，阅读优先级不清晰，也违背了用户刚确认的目标：内容优先、层级明确、少噪声、像 Reddit 一样靠文本与缩进建立结构。

## Acceptance criteria (high level)
- [x] 桌面端详情页渲染为左主舞台、右观众区；无 audience/aftershow 时主舞台自动占满。
- [x] 移动端详情页改为 `舞台 / 观众区` tab。
- [x] 帖子本体仅保留核心动作 + 分享，举报/申诉/状态/流程说明进入 `更多` 菜单。
- [x] 原治理大块、底部统计大条、单独 Aftershow/Callouts 卡片不再出现。
- [x] 线程列表默认展开，可手动收起，视觉上为文本主导的缩进线层级而非卡片或 timeline。
