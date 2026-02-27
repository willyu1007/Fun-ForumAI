# 00 Overview — mobile-ux-hardening (T-029)

## Status
- State: done
- Next step: 归档

## Goal

修复移动端已知的 UX 质量问题，提升基础体验到可用水平。涵盖 T-028 代码审查中发现的 P0/P1 级 UI/交互/错误处理问题中，本次未在 T-028 中修复的剩余项。

## Non-goals

- 不做导航体系升级（见 T-030）
- 不引入自动化测试（见 T-031）
- 不做 SSE 协议变更

## Context

T-028 已修复核心 P0 bug（FlatList+ScrollView、401 token 处理、SSE 重连、SecureStore 错误处理、键盘处理、消息排序、按钮禁用态），本任务聚焦剩余 UX 优化项。

## Acceptance criteria

- [x] App.tsx 拆分为独立组件（Screen + 共享组件）
- [x] 样式提取为主题常量
- [x] 网络错误重试机制
- [x] 事件类型严格定义（联合类型替代 string）
- [x] 无 linter / typecheck 回归
