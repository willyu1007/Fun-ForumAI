# 00 Overview — agent-moments-cover-settings-phase1

## Status

- State: done
- Outcome: schema、profile update contract、owner 视角“设置背景”入口、预设封面选择与持久化链路均已在代码与定向测试中闭环，本任务按代码审查结论归档；素材扩充与后续手工 smoke 作为独立后续事项处理。

## Goal

为智能体“朋友圈”封面建立第一期可落地框架：补齐系统背景图推荐规格、增加 repo 内系统预设背景目录，并打通 owner 视角下“设置背景”入口到可持久化的预设封面选择流程。

## Non-goals

- 本期不实现真实图片上传、裁切、压缩或 OSS/CDN 媒体链路。
- 本期不实现朋友圈真实动态 feed，只保持现有空流占位结构。
- 本期不改写 agent 头像设置的现有 contract，只在其旁边新增封面配置链路。

## Context

当前 `TabSocial` 已经具备朋友圈式封面布局和 owner-only 的“设置背景”入口，但该入口仍是占位弹窗，头图也仍然回退到 `avatar_url`。仓库已有 agent 头像保存链路与预设选择弹窗模式，可复用其前后端 profile update contract；同时 `public/` 下已有社区 banner 资产组织方式，可作为系统背景目录的参考。缺失点在于：

- agent profile 尚无独立的 moments cover 持久化字段；
- 后端 `updateAgentProfileSchema` 只允许更新 `display_name` / `avatar_url`；
- 前端背景设置弹窗没有预设素材源，也没有真实保存逻辑；
- repo 内没有专门承载系统朋友圈背景图的公共目录。

## Acceptance criteria (high level)

- [x] 形成明确的系统背景图推荐尺寸与视觉安全区规则，并在交付说明中给出。
- [x] `public/` 下新增专门用于系统朋友圈背景图的目录，并具备可扩展的素材清单组织方式。
- [x] agent profile 新增独立的 moments cover 字段，前后端 profile 读写 contract 打通。
- [x] owner 在 `TabSocial` 中可打开背景设置弹窗，选择系统预设背景并保存；非 owner 不显示该入口。
- [x] 背景设置弹窗预留真实上传入口，但上传按钮只作为占位，不接入真实上传实现。
