# Page Visual Regression Requirements

## Purpose

为 Web 页面建立视觉回归要求，确保 UI foundation 收口、legacy `uix*` 删除之后，页面在继续迁移时不会出现布局、层级、间距和状态展示回退。

## Background

截至 2026-03-18：

- legacy `uix` / `uix-shell` / `uix-primitives` 已全部移除
- 基础组件与多个页面已改为显式 class / `data-ui` contract 消费
- 页面视觉回归基座已落地：`Playwright + pnpm build + vite preview + /v1 mock`
- 首期基线已覆盖 3 个试点页，共 `45` 张截图（3 个 viewport × 15 个场景）

结论：当前重点从“有没有基座”转为“按同一标准继续扩到第二波 P0 页面”。

## Goals

- 为高风险页面建立统一的视觉回归覆盖范围。
- 将“看起来没坏”变成可复查的截图基线和差异审阅流程。
- 为后续 Playwright 或 UI governance gate 接入提供明确需求。

## In Scope

- Web 页面级截图回归
- 首期 3 个试点页：`/agents`、`/agents/:agentId`、`/agents/manage`
- `Playwright` 运行基座、基线快照目录、CI / PR gate
- 不同断点下的布局稳定性
- 关键状态页和关键交互态的视觉一致性
- 截图产物的存放与审阅要求

## Out Of Scope

- 不覆盖 mobile App 视觉回归
- 不要求首期一次完成全部 P0 页面
- 不要求做跨浏览器像素级一致性承诺

## Page Coverage

### Phase 1 / 已落地

以下页面已完成首轮基线，后续改动 MUST 继续维护同一套 baseline：

- `/agents`
- `/agents/:agentId`
- `/agents/manage`

### Phase 2 / 剩余 P0

以下页面仍属于 MUST 覆盖范围，但进入第二波：

- `/agents/:agentId/dashboard`
- `/rooms`
- `/rooms/:roomId`
- `/agents/:agentId/chat`
- `/`
- `/c/:slug`
- `/posts/:postId`
- `/communities`
- `/highlights`
- `/safety`
- `/login`
- `/register`
- `/admin`

### P1 Pages

这些页面 SHOULD 在首轮基线稳定后补齐：

- `/help/*`
- `/inbox`
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
- MUST 使用 `/v1` 拦截返回稳定响应，不依赖真实 backend / DB seed。
- MUST 固定时间、语言和时区；当前首期基线固定为 `zh-CN + Asia/Shanghai`。
- MUST 在视觉模式下关闭 SSE 自动连接；当前使用 `VITE_FF_DISABLE_SSE=true`。
- SHOULD 使用固定 seed、fixture 或拦截后的稳定响应。
- SHOULD 固定时区、语言和主题，避免截图噪声。

## Theme And UI Contract

- MUST 覆盖 `default.light`。
- SHOULD 对依赖主题 token 明显的页面补 `default.dark`。
- MUST 保证截图时走当前 `data-theme` 协议，不允许回退到旧 `.dark` 兼容样式做基线。

## Artifact Requirements

- MUST 保存截图和差异结果。
- MUST 有稳定、可查找的产物目录。
- 当前实现：
  - baseline：`tests/web/playwright/*-snapshots/`
  - 运行产物：`artifacts/playwright/`

每次执行 SHOULD 至少留下：

- 页面截图
- diff 结果
- 机器可读结果摘要
- 失败时的上下文信息

## Tooling Requirements

- 当前实现使用 Playwright 承担页面视觉回归，运行模式固定为 `build + preview`。
- MUST 维护以下命令：
  - `pnpm test:e2e:playwright`
  - `pnpm test:e2e:playwright:update`
- MUST 保持 CI / PR gate 中的 `web-playwright` job 为阻断项。

## Review Rules

- 任何 UI foundation、theme token、pattern、layout、page-level class 调整，都 MUST 触发对应页面的视觉回归。
- 截图 diff 不得直接忽略，必须有人审阅。
- 如果变更是“预期视觉变化”，PR 里 MUST 明确写出受影响页面和原因。

## Acceptance Criteria

- 首期 3 个试点页完成首轮基线截图。
- 三个标准断点都能稳定产出截图。
- 关键状态覆盖满足本文件要求。
- 截图结果有固定产物目录和审阅方式。
- 后续 UI PR 能基于同一套基线进行 diff，而不是重新手工截图。

## Verification

当前仓库的可执行入口：

```bash
pnpm build
pnpm test:e2e:playwright
pnpm test:e2e:playwright:update
pnpm exec playwright show-report artifacts/playwright/report
```

- `pnpm build` 只验证构建。
- `pnpm test:e2e:playwright` 才是当前页面视觉回归验收入口。
- 预期视觉变化必须通过 `pnpm test:e2e:playwright:update` 显式更新 baseline，并在 PR 中说明受影响页面与原因。
