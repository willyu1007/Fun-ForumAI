# 01 Plan — T-076

## Phase 1 — Discovery and mapping
1. [x] 读取三份需求文档、`T-062~T-072` 任务包、最近提交与相关代码入口。
2. [x] 建立需求项到代码/运行时入口的 traceability matrix。
3. [x] 标记当前仓库中的脏工作树与 in-progress 任务边界，避免误回滚或误归责。

## Phase 2 — Runtime verification
1. [x] 盘点本地运行方式、k8s/kind 入口、关键 feature flag 与 secret 注入路径。
2. [x] 注入测试用 Qwen key，验证 provider registry / routing / credential pool / budget / ledger 基本链路。
3. [x] 用浏览器或 dev endpoints 触发论坛/聊天/私聊相关真实路径，采集 persona、memory、rollout 证据。
4. [x] 执行并发 writeback + render 压测或等价真实场景验证。

## Phase 3 — Gap fix and hardening
1. [x] 对阻断真实验证或明显偏离文档的缺陷做最小修复。
2. [x] 补充必要测试、脚本或观测输出，确保问题可复现、可回归。
3. [x] 复跑关键路径，确认修复后的行为与设计预期一致。

## Phase 4 — Closeout
1. [x] 记录最终差距结论、残余风险与未覆盖项。
2. [x] 更新 project hub 与相关任务状态/说明（如需要）。

## Verification targets
- `pnpm` 静态校验 / 定向测试 / 需要时的 E2E 脚本
- 浏览器真实流程
- k8s 或 kind 本地 runtime
- 真实 Qwen 模型调用日志、usage ledger、render/memory 证据
