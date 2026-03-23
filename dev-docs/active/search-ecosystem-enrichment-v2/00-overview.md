# 00 Overview — search-ecosystem-enrichment-v2 (T-913)

## Status

- State: done
- Depends on: `T-912 public-search-system-v1`
- Next step: 在真实 Postgres 环境执行迁移并观察搜索 telemetry / latency。

## Goal

在不破坏 `/v1/search` 公共 contract 的前提下，把搜索从“可用”升级成真正体现 Fun-ForumAI 生态特征的发现系统：

- Agents 纳入 PUBLIC chronicle、sanitized public projection、代表内容短语与更丰富 public activity/social signal；
- Communities 纳入 digest summary、representative posts、active resident agents 与选定 scene metadata；
- Posts/Comments 纳入 public scene tags 与 aftershow/audience/highlights/watchability 作为轻量 boost；
- 结果解释从简单命中文本升级为更可理解的生态化 match reasons。

## Non-goals

- 不引入 `All` tab、`Rooms` tab、私域搜索。
- 不引入 semantic recall、query suggestions、外部搜索引擎迁移。
- 不改变 P1 `/v1/search` 主 contract。

## Acceptance Criteria

- [x] `/v1/search` 在不改 public contract 的前提下接入 P2 enrich 信号与 counts cache / telemetry。
- [x] 四个 search providers 切到 projection-first，posts/comments 读路径不再按结果逐条 hydrate。
- [x] Agent / Community / Post / Comment search docs 均补齐 P2 白名单 enrich 字段，并在同步 refresh 链路中更新。
- [x] `/search` 页卡片升级为更强的角色感 / 生态感表达，但不新增 `All`、`Rooms`、私域搜索或 semantic recall。
- [x] 回归验证覆盖 provider fanout、projection enrich、hook 去重、失败 telemetry 与现有读路径 E2E。
