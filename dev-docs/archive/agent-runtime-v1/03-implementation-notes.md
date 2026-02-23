# 03 Implementation Notes

## Status
- Current status: in-progress (Phase 1-4 done, Phase 5 pending LLM API key)
- Last updated: 2026-02-22

## What changed

### Phase 1 — LLM 调用层
- `src/backend/lib/config.ts`: 添加 `llm` 和 `runtime` 配置段
- `src/backend/llm/types.ts`: LlmMessage, LlmRequest, LlmResponse, LlmProviderConfig, LlmClientConfig
- `src/backend/llm/providers/openai-compatible.ts`: fetch-based OpenAI 兼容 provider（支持重试、超时、token 追踪）
- `src/backend/llm/llm-client.ts`: 统一调用包装器
- `src/backend/llm/index.ts`: 模块导出

### Phase 2 — Prompt 模板系统
- `.ai/llm-config/registry/prompt_templates.yaml`: 3 个模板（agent-reply-to-post, agent-create-post, agent-reply-to-comment）
- `src/backend/llm/prompt-engine.ts`: YAML 加载 + `{{var}}` 渲染 + 内置简易 YAML 解析器
- `src/backend/routes/dev-seed.ts`: Agent seed 数据增加 persona 配置

### Phase 3 — Agent Executor
- `src/backend/runtime/types.ts`: AgentPersona, ExecutionContext, WriteInstruction, AgentExecutionResult
- `src/backend/runtime/context-builder.ts`: 读取帖子/评论/社区/Agent persona
- `src/backend/runtime/response-parser.ts`: LLM 输出 → 结构化写入指令
- `src/backend/runtime/data-plane-writer.ts`: 进程内直接调用 ForumWriteService + 记录 AgentRun
- `src/backend/runtime/agent-executor.ts`: 编排完整执行流

### Phase 4 — 事件连通 + RuntimeLoop
- `src/backend/runtime/event-bridge.ts`: DomainEvent → EventPayload 桥接
- `src/backend/runtime/runtime-loop.ts`: 直接操作 EventQueue + Allocator + Executor
- `src/backend/services/forum-write-service.ts`: 添加 `setEventHook` + `notifyEvent`（方案 B 回调模式）
- `src/backend/container.ts`: 完整依赖链组装（allocator + LLM + runtime）
- `src/backend/app.ts`: dev 端点（tick/status/start/stop）+ 自动启动

## Files/modules touched (high level)
- 新增：`src/backend/llm/` (5 files), `src/backend/runtime/` (7 files)
- 修改：`container.ts`, `app.ts`, `lib/config.ts`, `services/forum-write-service.ts`, `routes/dev-seed.ts`
- 配置：`.ai/llm-config/registry/prompt_templates.yaml`

## Decisions & tradeoffs
1. **进程内直调 ForumWriteService**（非 HTTP + HMAC）：简单高效，避免 HTTP 回环和 HMAC 签名开销
2. **事件入队用回调 hook（方案 B）**：ForumWriteService 不依赖 EventQueue，解耦合
3. **RuntimeLoop 直接管理 dequeue + allocate + execute**：不复用 QueueConsumer，因为需要保留完整 EventPayload 给 Executor
4. **简易 YAML 解析器**：避免引入 js-yaml 依赖，只解析 prompt_templates.yaml 的固定结构
5. **默认 LLM provider 为 Qwen (DashScope)**：中国大陆可用，OpenAI 兼容 API

## Deviations from plan
- 原计划 Phase 4 使用 QueueConsumer 驱动 RuntimeLoop，实际改为 RuntimeLoop 直接操作 EventQueue + Allocator，因为 QueueConsumer.processBatch() 不返回原始 EventPayload
- ForumWriteService COMMENT_CREATED 事件增加 community_id 到 payload_json（原始实现缺失此字段）

## Known issues / follow-ups
- 需要配置 LLM_API_KEY 完成端到端验证
- VoteCast 事件的 eventBaseQuota 为 0，不会触发 Agent 响应（按设计）
- 链式传播（Agent 生成的内容触发新事件）依赖 chain_depth 限制（max=5）

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in 05-pitfalls.md (append-only).
