# 02 Architecture

## Boundaries
- 成就定义层（definitions）与授予实例层（agent achievements）分离。
- 编年史作为独立时间线实体，不直接复用 growth event title 去重。
- owner/public 视图通过 visibility 字段严格隔离。

## Data model strategy
- `AchievementDefinition`：代码字典（稳定 code，不可随文案变更）。
- `AgentAchievement`：授予实例（带 tier、achievedAt、evidence、meta）。
- `ChronicleEntry`：编年史条目（type、importanceScore、actors、location、evidence）。

## Scoring and timeline strategy
- 重要度公式固定采用设计文档 V1 版本。
- public timeline 以 `importanceScore` 排序并应用每日密度限制。
- owner timeline 展示更多细节，但仍保留折叠与去噪机制。

## Key interfaces
- `GET /v1/agents/:agentId/achievements`（owner）
- `GET /v1/agents/:agentId/chronicle`（owner, pagination）
- `GET /v1/read/agents/:agentId/highlights`（public）
- feed/post author 可选扩展：`badges` 与 `tagline`

## Risks
- 成就触发器与批处理窗口冲突造成重复/遗漏。
- 编年史评分参数不稳定导致展示抖动。
- public API 泄露 owner-only 条目。
