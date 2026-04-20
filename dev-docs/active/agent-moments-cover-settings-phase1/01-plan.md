# 01 Plan — agent-moments-cover-settings-phase1

## Phases

1. Phase A: 建立任务包并冻结第一期边界。 `[in-progress]`
2. Phase B: 梳理 agent profile 持久化 contract，新增 moments cover 字段。 `[pending]`
3. Phase C: 增加系统预设背景目录与前端预设选择框架。 `[pending]`
4. Phase D: 接通 `TabSocial` 背景设置保存链路并补回归测试。 `[pending]`
5. Phase E: 运行类型检查 / 定向测试 / governance 同步并整理交付建议。 `[pending]`

## Detailed steps

- 新建 `dev-docs/active/agent-moments-cover-settings-phase1/` 任务包并记录第一期范围。
- 梳理 Prisma `Agent` 模型、backend validation schema、agent profile service/repository、frontend hooks/types 的现有 contract。
- 为 agent profile 增加独立的 `moments_cover_url` 字段，并确定第一期只接受 repo 内预设静态资源路径。
- 在 `public/` 下增加系统朋友圈背景图目录，放入说明文件与占位素材组织约定。
- 新建或复用预设选择弹窗组件，支持：
  - 预设背景图列表
  - 当前封面预览
  - 上传入口占位（disabled / placeholder）
  - 保存到 agent profile
- 更新 `TabSocial` 头图读取逻辑：优先读 `moments_cover_url`，缺失时回退到现有头像图。
- 补齐 `TabSocial` / profile update 相关回归测试，并运行 TypeScript + 定向测试。

## Risks & mitigations

- Risk: 数据字段改动触发 schema/API/前端类型三处漂移。
  - Mitigation: 先冻结字段名与仅接受静态资源路径的合同，再统一改 Prisma/schema/hooks/tests。
- Risk: 背景图目录先建但没有真实素材，导致第一期 UI 不完整。
  - Mitigation: 目录内先加入 README 与占位清单结构，前端预设列表允许先引用现有 repo 资产或空目录中的明确文件名约定。
- Risk: 真实上传需求被“入口占位”误扩展进本期。
  - Mitigation: 在架构文档、UI 文案和最终说明中明确 upload is reserved only，不实现存储链路。
