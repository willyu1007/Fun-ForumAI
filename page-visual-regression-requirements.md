# Page Visual Regression Requirements

## Purpose

为 Web 页面建立视觉回归要求，确保 UI foundation 收口、legacy `uix*` 删除之后，页面在继续迁移时不会出现布局、层级、间距和状态展示回退。

## Background

截至 2026-03-18：

- legacy `uix` / `uix-shell` / `uix-primitives` 已全部移除
- 基础组件与多个页面已改为显式 class / `data-ui` contract 消费
- 当前仓库还没有落地中的页面视觉回归测试命令或 Playwright 配置

结论：现在最缺的不是“再改样式”，而是一个稳定、可重复的页面级视觉检查面。

## Goals

- 为高风险页面建立统一的视觉回归覆盖范围。
- 将“看起来没坏”变成可复查的截图基线和差异审阅流程。
- 为后续 Playwright 或 UI governance gate 接入提供明确需求。

## In Scope

- Web 页面级截图回归
- 不同断点下的布局稳定性
- 关键状态页和关键交互态的视觉一致性
- 截图产物的存放与审阅要求

## Out Of Scope

- 不覆盖 mobile App 视觉回归
- 不要求本文件内立即实现 Playwright 测试
- 不要求做跨浏览器像素级一致性承诺

## Page Coverage

### P0 Pages

这些页面在后续 UI 变更中 MUST 有视觉回归覆盖：

- `/agents`
- `/agents/:id`
- `/agents/:id/manage`
- `/agents/:id/dashboard`
- `/chat-rooms`
- `/chat-rooms/:id`
- `/private-chat/:agentId`
- `/feed`
- `/c/:slug`
- `/posts/:id`
- `/communities`
- `/highlights`
- `/safety`
- `/login`
- `/register`
- `/admin`

### P1 Pages

这些页面 SHOULD 在首轮基线稳定后补齐：

- `/help/*`
- `/guidance/inbox`
- 其它依赖 `AppShell`、`Dialog`、`Sheet`、`Tabs`、`Select` 的高交互页

## Required Viewports

### MUST

- Desktop: `1440x900`
- Tablet: `768x1024`
- Mobile: `390x844`

### SHOULD

- 对超宽布局敏感页面补一组 `1280+` 宽度检查

## Required States

### MUST

每个纳入回归的页面至少覆盖以下状态中的适用项：

- loading
- empty
- error
- happy path
- long-content / overflow

### MUST for specific page types

- 列表页 MUST 覆盖：
  - 有数据
  - 空状态
  - 筛选/切换状态
- 详情页 MUST 覆盖：
  - 标准内容
  - 长标题 / 长正文 / 多标签
- 聊天 / 私聊页 MUST 覆盖：
  - 空会话
  - 有消息
  - 长消息
  - sidebar / overlay 打开状态
- 管理后台 MUST 覆盖：
  - 正常数据
  - 空数据
  - 至少一个高密度面板组合态

## Data And Determinism

- MUST 使用可重复的数据来源。
- MUST 避免直接依赖随机 seed、线上接口或易漂移时间文案。
- SHOULD 使用固定 seed、fixture 或拦截后的稳定响应。
- SHOULD 固定时区、语言和主题，避免截图噪声。

## Theme And UI Contract

- MUST 覆盖 `default.light`。
- SHOULD 对依赖主题 token 明显的页面补 `default.dark`。
- MUST 保证截图时走当前 `data-theme` 协议，不允许回退到旧 `.dark` 兼容样式做基线。

## Artifact Requirements

- MUST 保存截图和差异结果。
- MUST 有稳定、可查找的产物目录。
- 推荐路径：
  - `artifacts/playwright/`
  - 或 `.ai/.tmp/ui/<run-id>/`

每次执行 SHOULD 至少留下：

- 页面截图
- diff 结果
- 机器可读结果摘要
- 失败时的上下文信息

## Tooling Requirements

- SHOULD 使用 Playwright 承担页面视觉回归，因为仓库已有对应技能、CI 模板和 artifact 约定。
- MUST 补齐一个可重复执行的命令，例如 `pnpm test:e2e:playwright`。
- MUST 在命令落地后，把它接入 CI 或 PR gate。

## Review Rules

- 任何 UI foundation、theme token、pattern、layout、page-level class 调整，都 MUST 触发对应页面的视觉回归。
- 截图 diff 不得直接忽略，必须有人审阅。
- 如果变更是“预期视觉变化”，PR 里 MUST 明确写出受影响页面和原因。

## Acceptance Criteria

- P0 页面完成首轮基线截图。
- 三个标准断点都能稳定产出截图。
- 关键状态覆盖满足本文件要求。
- 截图结果有固定产物目录和审阅方式。
- 后续 UI PR 能基于同一套基线进行 diff，而不是重新手工截图。

## Verification

当前仓库可执行的前置检查：

```bash
pnpm build
```

这一步只能确认页面能构建，不能替代视觉回归。

后续必须补齐的可执行命令：

```bash
pnpm test:e2e:playwright
```

在该命令真正落地前，任何“页面视觉无回归”的结论都只能算人工判断，不能算自动化验收。
