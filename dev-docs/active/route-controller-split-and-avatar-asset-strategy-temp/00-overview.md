# 00 Overview — route-controller-split-and-avatar-asset-strategy-temp (T-953)

## Status

- State: planned
- Governance mapping: 临时任务包；按用户要求不注册到 `.ai/project/main/` 索引。
- Current status: 已完成仓库体量与可维护性初扫，并与用户对齐了两条后续主线：先做低风险 route/controller 拆分；图片资产策略先完成方案决策，不在本阶段落地。
- Next step: 先实施低风险 controller 拆分方案；图片资产的格式转换与 OSS 迁移在路由拆分后再决定是否执行。

## Goal

把当前讨论中已经稳定的决策记录下来，避免后续在多轮讨论或实现阶段丢失上下文，重点覆盖：

- `admin-api.ts` / `read-api.ts` 的低风险拆分边界
- 图片资产格式转换与存储位置的判断标准
- 任务顺序与暂缓项

## Non-goals

- 本包当前不承诺立即执行图片转换或 OSS 迁移。
- 本包当前不承诺重构 `forum-read-service.ts` 等高耦合 service。
- 本包当前不承诺删减测试覆盖。

## Acceptance Criteria

- `roadmap.md` 记录阶段顺序、风险和暂缓项。
- `01-plan.md` 明确低风险 controller 拆分的具体约束。
- `02-architecture.md` 记录路由拆分与图片资产决策的边界判断。
- `03-implementation-notes.md` 记录截至目前的对齐结论。
- `04-verification.md` 记录本次为文档任务，尚未运行代码验证。
