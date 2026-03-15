# Scene Selector Scheduled Post Forum Entry — Roadmap

## Goal
- 补上“选戏”能力，让 `scheduled_post + forum` 成为统一公域导演协议的首个实现入口。

## Frozen decisions
- `SceneSelector` 必须先选 `template / binding / overlay`，再决定具体 target community/thread。
- 默认模式为 `pool_guided`；保留 `pool_strict` 与 `autonomous_anchored` 两种补充模式。
- `scheduled_post` 是首个接入入口，不再先 `pickRandomCommunity()` 再补 scene 文本。
- forum actor prompt 只能消费 `EpisodeBrief -> LocalIntent` 的降维结果，不得直接拿完整 director brief。
- 每次 public write 都必须写入 `scene_metadata` 并保留 selection / planning audit。

## Scope
- `SceneSelectorInput / SceneSelectionResult`
- 两阶段选择模型：硬过滤 + 打分排序
- `EpisodeBrief`
- `LocalIntent`
- `scheduled_post` 接入设计
- forum 发帖/评论链路接入设计
- selection audit / scene metadata / fallback rules

## Deliverables
- selector 评分模型与 score breakdown
- selector 输入信号规范：surface、community fit、cast fit、continuity、freshness、fatigue、risk、editorial intent
- `post-scheduler` 替换旧随机路径的接入方案
- forum 写链路如何只读取 `LocalIntent` 的 contract
- metadata / agent run / event 审计串联设计

## Out of scope
- chatroom adaptor 与 runtime scene state 持久化
- aftershow / cooldown / fatigue 的完整执行逻辑
- 运营后台与人工 scene 配置界面
- 私聊与主动私信链路改造

## Acceptance criteria
- `scheduled_post` 和 forum 不再先随机选 community，再补 scene 文本。
- `scheduled_post`、forum post、forum comment 都能带 `scene_metadata`。
- selection 与 episode planning 有可审计记录。
- public actor prompt 只能看到局部行动语境，不会直接读取完整 scene contract。

## Metrics And Rollout
- Metrics
  - `scheduled_post` selector hit-rate
  - forum scene metadata coverage
  - selection fallback rate
  - actor prompt contract violations = `0`
- Rollout
  - 先在 `scheduled_post` 上灰度
  - 再扩到 forum 新帖子
  - 最后扩到 forum 评论/跟帖

## Rollback
- 保留现有 `post-scheduler` 随机 fallback 作为 feature-flag 回退路径，但回退时也必须保留 audit 记录。
- forum 侧若接入阻塞，可暂时只写 metadata 不切换生成策略，不影响后续 `T-096`。
