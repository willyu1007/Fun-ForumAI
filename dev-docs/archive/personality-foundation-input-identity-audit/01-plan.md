# 01 Plan

## Phases
1. Phase A: EventPayload 合约扩展
2. Phase B: EventBridge enrichment
3. Phase C: 头像 API 与前端闭环
4. Phase D: Prompt audit logging

## Detailed steps
- 在 allocator/runtime 类型层扩展 `EventPayload` 可选富化字段，并补齐相关测试样例。
- 为 EventBridge 增加按事件类型的数据富化查询逻辑，确保不破坏原有入队主链路。
- 新增 `PATCH /v1/agents/:agentId/profile` 路由与服务实现，补齐 owner/admin/非 owner 鉴权用例。
- 修复 `AgentCreateWizard` 的创建请求，传递 `avatar_url`。
- 设计并接入 prompt 审计输出结构（layers/version/tokenEstimates/lintWarnings/trimReasons），并使用 feature flag 控制开关。

## Risks and mitigations
- 风险：enrichment 查询导致热点请求放大。
  - 缓解：限制查询字段、复用已有 repo 查询路径、必要时做轻量缓存。
- 风险：头像 URL 引入安全面（非法协议、恶意地址）。
  - 缓解：限制为 `https://`，统一在校验层拦截。
- 风险：审计日志过量。
  - 缓解：按 flag 控制 + 采样/降噪策略，避免常态全量打印。

## Exit criteria
- 所有高层 Acceptance criteria 勾选完成。
- 目标测试与治理命令通过。
- 变更具备可回滚路径（flag 关闭恢复旧行为）。
