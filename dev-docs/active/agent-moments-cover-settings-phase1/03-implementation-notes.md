# 03 Implementation Notes — agent-moments-cover-settings-phase1

## Status

- Current status: `in-progress`
- Last updated: 2026-04-19

## What changed

- 建立第一期任务包，冻结范围为“系统预设背景可保存 + 上传入口占位”，不包含真实上传链路。
- 为 Prisma `Agent` 模型新增 `moments_cover_url`，并手写 migration `20260419170000_t984_agent_moments_cover_phase1`。
- 扩展 backend agent profile update contract：`updateAgentProfileSchema`、`agentService.updateProfile`、in-memory/pg repository、`agent-control` route 都已支持 `moments_cover_url`。
- 扩展 frontend agent DTO 与 mutation hook：`Agent` / `useUpdateAgentProfile` 已支持 `moments_cover_url`。
- 新增 `public/agent-moments-covers/` 目录，并把现有 `community-banners` 复制为第一批 starter presets；目录内新增 `README.md` 记录推荐尺寸、视觉规则与命名约束。
- 新增 `preset-agent-moments-covers.ts` 与 `PresetCoverDialog.tsx`，让 `TabSocial` 的 owner-only “设置背景”入口变成真实的预设背景选择弹窗，支持保存系统背景图并保留 disabled 上传入口。

## Files/modules touched (high level)

- `prisma/schema.prisma`
- `prisma/migrations/20260419170000_t984_agent_moments_cover_phase1/migration.sql`
- `src/backend/{repos,services,routes,validation,identity}/**`
- `src/frontend/api/**`
- `src/frontend/shared/{components,utils}/**`
- `src/frontend/features/agents/components/modal/{TabSocial.tsx,__tests__/TabSocial.test.tsx}`
- `public/agent-moments-covers/*`
- `dev-docs/active/agent-moments-cover-settings-phase1/*`

## Decisions & tradeoffs

- Decision: 第一阶段新增独立的 moments cover 字段，而不是继续复用 `avatar_url`。
  - Rationale: 头像与朋友圈封面是不同媒体语义，继续复用会造成后续上传、裁切和素材推荐双轨。
  - Alternatives considered: 直接把封面继续设为头像放大版；被拒绝，因为语义与后续扩展性都不成立。
- Decision: 第一阶段只允许系统预设静态路径。
  - Rationale: 可以先把完整 FE/BE 配置链路落地，但不把真实上传和媒体安全策略一起卷入本期。
  - Alternatives considered: 同步做真实上传；被延后到第二阶段。

## Deviations from plan

- 为了让第一期目录落地且不引入额外二进制制作流程，首批系统背景图先复用了现有 `public/community-banners/*.webp` 作为 starter set，而不是新增一套独立图片。
  - Impact: 目录和保存链路已完整，但素材语义仍偏“banner”而非完全“朋友圈封面”；后续可单独替换图片，不影响 contract。

## Known issues / follow-ups

- 还未执行 owner 视角的人工 smoke；当前只有自动化验证。
- 第二期上传实现时需要放宽 `moments_cover_url` 后端校验合同，并补媒体安全策略、裁切尺寸与存储边界。

## Pitfalls / dead ends (do not repeat)

- Keep the detailed log in `05-pitfalls.md` (append-only).
