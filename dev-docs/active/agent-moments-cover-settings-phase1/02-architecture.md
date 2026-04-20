# 02 Architecture — agent-moments-cover-settings-phase1

## Context & current state

- `src/frontend/features/agents/components/modal/TabSocial.tsx` 已有 owner-only “设置背景”入口，但弹窗仍是占位说明。
- `src/frontend/features/agents/components/modal/TabIntro.tsx` 已接通 agent avatar 的 owner 保存链路，可作为 profile update 交互参考。
- `src/frontend/shared/components/PresetAvatarDialog.tsx` 已提供“预设选择 + 上传占位 + 保存”的对话框模式，可复用其交互 schema。
- backend `updateAgentProfileSchema` 当前仅允许 `display_name` 与 `avatar_url`。
- Prisma `Agent` 模型当前无朋友圈封面字段，因此 `TabSocial` 只能回退到 `avatar_url` 充当头图。

## Proposed design

### Components / modules

- Prisma `Agent` 模型新增 `momentsCoverUrl`（DB 列名 `moments_cover_url`）。
- backend agent profile 更新 contract 扩展 `moments_cover_url`。
- frontend agent profile 类型 / hooks / query invalidation 同步扩展 `moments_cover_url`。
- `public/agent-moments-covers/` 作为系统提供的朋友圈背景图静态目录。
- 新的预设背景元数据工具（例如 `preset-agent-moments-covers.ts`）管理系统预设列表。
- `TabSocial` 复用/适配现有预设对话框模式，接通 owner-only 保存链路，并保留 disabled 上传入口。

### Interfaces & contracts

- API endpoints:
  - 继续复用现有 agent profile update endpoint；请求体新增可选字段 `moments_cover_url`。
- Data models / schemas:
  - Prisma `Agent.momentsCoverUrl?: string | null`
  - `updateAgentProfileSchema` 允许 `moments_cover_url`
  - frontend agent profile DTO 增加 `moments_cover_url?: string | null`
- Static assets:
  - 系统预设背景图路径必须位于 `/agent-moments-covers/...`
  - 第一阶段仅允许系统静态资源路径；不接受任意外链上传 URL
- Events / jobs (if any):
  - 无新增后台 job

### Boundaries & dependency rules

- Allowed dependencies:
  - `TabSocial` 可依赖 agent hooks、静态预设工具、共享对话框组件
  - backend route/controller/service 继续通过现有 profile update 路径改值
- Forbidden dependencies:
  - 不新增直接媒体上传 API
  - 不让 frontend 直接拼接任意外部 URL 作为持久化 cover path
  - 不在业务层泄露 Prisma 到 frontend 或 widget 层

## Data migration (if applicable)

- Migration steps:
  - 为 `Agent` 表新增 nullable 列 `moments_cover_url`
- Backward compatibility strategy:
  - 读路径优先读 `moments_cover_url`，为空时继续回退到现有 `avatar_url`
  - 更新接口保持向后兼容；旧调用方无需传新字段
- Rollout plan:
  - 先上线字段 + UI 保存链路
  - 后续第二期再接真实上传/裁切/素材生成

## Non-functional considerations

- Security/auth/permissions:
  - 只有 owner/manage 视图允许看到背景设置入口并调用更新
  - 第一阶段只接受系统静态路径，避免任意外链注入
- Performance:
  - 头图仍使用静态资源直链，避免新增请求层
- Observability (logs/metrics/traces):
  - 依赖现有 profile update 错误处理；本期不新增埋点

## Open questions

- 系统预设背景图第一批是否直接加入真实素材，还是先只建目录与文件名约定。
- 上传入口第二期是复用 agent avatar 的媒体上传 contract，还是新建 cover-specific upload policy。
