# 00 Overview — route-controller-split-and-avatar-asset-strategy-temp (T-953)

## Status

- State: done
- Governance mapping: 临时任务包；当前按归档态保留实现记录。
- Current status: 已完成图片资产迁移的安全执行链；运行时本地 `.png -> .webp` 兼容层已删除，前端只接受真实资源路径；PWA/favicon 旧引用链已清理，社区 banner 已统一为 `webp`；后端 `typecheck` 基线已修复；`admin-api.ts` 与 `read-api.ts` 已完成四批低风险机械拆分，已抽离审查/反馈/申诉、runtime/closeout/rollout/ops、admin risk/media/hot-topic，以及 read 侧 policy/discussion/feed/post/agent 等路由组，并保持路径、中间件、验证与响应结构不变。`admin-api.ts` 与 `read-api.ts` 现在都已收口为组合注册根文件。当前又补做了一轮针对已拆路由的测试去重瘦身，并完成 `LaunchProgrammingOpsService` 的第一刀低风险内部拆分：保留现有公开类与公开方法不变，仅把 slot recommendation 相关纯逻辑抽到独立模块，并用现有公开方法做回归验证。
- Outcome: 本任务记录的低风险路由拆分、静态图片资产收口，以及首个大 service 内部拆分都已完成并留下验证证据；后续如继续推进更多 service 拆分，应另起后续任务，不再阻塞本包归档。

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
