# 00 Overview — mobile-test-automation (T-031)

## Status
- State: done
- Next step: 选择测试框架并编写首批单元测试

## Goal
为移动端建立自动化测试基线，替换当前的占位脚本（`mobile:test` 输出 "No mobile tests yet"）。

## Non-goals
- 不做 E2E / UI 自动化测试（Detox/Maestro 在后续评估）。
- 不修改业务逻辑。

## Context
T-028 建立了 `apps/mobile` Expo 基线，但测试为空占位。API client、token store、SSE client 是最优先的测试目标。

## Acceptance criteria
- [x] API client 单元测试（正常/401/超时场景）
- [x] Token store 单元测试
- [x] SSE client 集成测试（连接/重连/auth error）
- [x] `pnpm -s mobile:test` 全绿且有实际用例
- [x] CI 可运行（无真机依赖）
