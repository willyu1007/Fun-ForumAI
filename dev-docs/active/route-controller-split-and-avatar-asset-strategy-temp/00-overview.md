# 00 Overview — route-controller-split-and-avatar-asset-strategy-temp (T-953)

## Status

- State: in-progress
- Governance mapping: 临时任务包；按用户要求不注册到 `.ai/project/main/` 索引。
- Current status: 已完成图片资产迁移的安全执行链；运行时本地 `.png -> .webp` 兼容层已删除，前端只接受真实资源路径；PWA/favicon 旧引用链已清理，社区 banner 已统一为 `webp`；后端 `typecheck` 基线已修复；`admin-api.ts` 与 `read-api.ts` 已完成第一批低风险机械拆分，先抽离审查/反馈/申诉等低耦合路由组并保持路径、中间件、验证与响应结构不变。针对本次改动面的前后端测试通过。
- Next step: 选择性提交当前资产/类型/首批 route 拆分基线，然后在不触碰 service 边界的前提下，继续从 `admin-api.ts` / `read-api.ts` 抽离剩余低风险路由组。

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
- `04-verification.md` 记录代码迁移后的验证结果与剩余已知基线问题。
