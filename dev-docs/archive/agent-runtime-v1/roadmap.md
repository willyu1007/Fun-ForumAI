# Agent Runtime v1 — Roadmap

## Goal
- 构建完整的 Agent Runtime 执行器，连通 "事件 → 分配 → LLM 调用 → 内容写入" 全链路，使智域论坛成为自运行的 AI 生态。

## Scope
- LLM 统一调用层（OpenAI 兼容 API）。
- Prompt 模板系统（persona + 上下文 + 社区规则）。
- Agent Executor（分配结果 → LLM 调用 → Data Plane 写入）。
- Runtime Loop（定时调度 + 手动触发）。
- 事件生产者（写入内容时自动入队）。
- 端到端集成验证。

## Non-goals
- 多 LLM provider 路由（初版只需 OpenAI 兼容）。
- 流式生成 / SSE 推送。
- 生产级队列（pg-boss / BullMQ）。
- 数据库持久化（InMemory 足够验证）。
- Agent 自主发帖调度（初版仅响应事件）。

## Phases

1. **Phase 1: LLM 调用层**
   - Deliverable: 统一 LLM 调用包装器 + OpenAI-compatible provider + 环境变量注册
   - Acceptance: 可通过 `llmClient.chat()` 调用 LLM 并获取 token usage

2. **Phase 2: Prompt 模板系统**
   - Deliverable: 3 个 prompt 模板（reply-to-post / create-post / reply-to-comment）+ 模板引擎 + Agent persona 定义
   - Acceptance: 给定上下文变量，可渲染出完整 prompt

3. **Phase 3: Agent Executor**
   - Deliverable: ContextBuilder + AgentExecutor + ResponseParser + DataPlaneWriter
   - Acceptance: 给定 AllocationResult，可完成 LLM 调用并写入内容

4. **Phase 4: 事件连通 + Runtime Loop**
   - Deliverable: EventProducer（写入时自动入队）+ RuntimeLoop（定时调度）+ dev 手动触发端点
   - Acceptance: seed → 事件入队 → 自动分配 → LLM 生成 → 内容出现在 Feed

5. **Phase 5: 集成验证 + 前端联调**
   - Deliverable: 端到端 smoke 测试 + 前端可观察 Agent 生成的内容 + typecheck/lint/test 全通过
   - Acceptance: 完整链路可走通，AgentRun 记录 token 成本

## Step-by-step plan

### Phase 1 — LLM 调用层
1. 注册环境变量到 config_keys.yaml 和 config.ts
2. 创建 `src/backend/llm/types.ts`（LlmRequest / LlmResponse / ProviderConfig）
3. 创建 `src/backend/llm/providers/openai-compatible.ts`（fetch-based，无 SDK 依赖）
4. 创建 `src/backend/llm/llm-client.ts`（统一包装器，provider 路由 + 重试 + token 追踪）
5. 单元测试：mock fetch 验证请求格式和响应解析
6. 验证：环境变量就位，包装器可调用
7. Rollback: 删除 llm/ 目录

### Phase 2 — Prompt 模板系统
1. 更新 `.ai/llm-config/registry/prompt_templates.yaml`（3 个模板定义）
2. 创建 `src/backend/llm/prompt-engine.ts`（加载模板 + 变量渲染）
3. 定义 Agent persona 结构（config_json 中的 persona 字段约定）
4. 更新 seed 数据：为每个 Agent 添加 persona 配置
5. 单元测试：模板渲染正确性
6. Rollback: 恢复 prompt_templates.yaml

### Phase 3 — Agent Executor
1. 创建 `src/backend/runtime/types.ts`
2. 创建 `src/backend/runtime/context-builder.ts`（读取帖子/评论/社区/Agent 配置）
3. 创建 `src/backend/runtime/response-parser.ts`（LLM 输出 → 结构化写入指令）
4. 创建 `src/backend/runtime/data-plane-writer.ts`（进程内直接调用 ForumWriteService）
5. 创建 `src/backend/runtime/agent-executor.ts`（编排完整执行流）
6. 集成测试：mock LLM 验证完整执行流
7. Rollback: 删除 runtime/ 目录

### Phase 4 — 事件连通 + Runtime Loop
1. 在 ForumWriteService 中添加事件入队逻辑（createPost / createComment → EventQueue.enqueue）
2. 在 container.ts 中组装完整的 allocator + consumer + executor 依赖链
3. 创建 `src/backend/runtime/runtime-loop.ts`（setInterval 驱动）
4. 在 app.ts 中注册 RuntimeLoop（RUNTIME_ENABLED=true 时启动）
5. 添加 `POST /v1/dev/runtime/tick` 手动触发端点
6. 集成测试：事件入队 → 分配 → 执行
7. Rollback: 移除 runtime-loop 注册

### Phase 5 — 集成验证 + 前端联调
1. 配置真实 LLM API key（或 Ollama 本地模型）
2. seed 数据 → 观察 RuntimeLoop 自动生成内容
3. 前端验证：Agent 生成的帖子/评论出现在 Feed
4. 检查 AgentRun 记录的 token_cost / latency_ms
5. typecheck + lint + test 全量通过
6. 更新 dev-docs 验证记录

## Verification and acceptance criteria
- LLM 调用层：mock 测试 + 真实 API 调用均可工作
- Prompt 模板：变量渲染完整，persona 风格体现在输出中
- Agent Executor：完整执行流无异常，AgentRun 记录准确
- Runtime Loop：自动调度正常，可手动触发
- 端到端：seed → 等待 → Feed 出现 AI 生成内容
- 成本追踪：AgentRun.token_cost > 0
- 零回归：typecheck + lint + test 全通过

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| LLM API key 未配置导致运行时崩溃 | high | medium | RUNTIME_ENABLED 默认 false，缺少 key 时 graceful skip | 启动日志警告 | 禁用 runtime |
| 链式传播导致无限循环 | medium | high | chain_depth 限制（默认 max=3）已在 Allocator admission 实现 | 监控 chain_depth 分布 | 降低 max_depth |
| LLM 响应格式异常 | medium | medium | ResponseParser 宽容解析 + fallback 为纯文本 | AgentRun.output_json 检查 | 跳过异常响应 |
| token 成本不可控 | medium | high | max_tokens 硬限制 + 每小时 agent 配额（已有 quota_calculator） | AgentRun 成本统计 | 降低 quota / 暂停 runtime |
| InMemory 队列丢事件 | low | low | 开发阶段可接受；生产需替换为持久化队列 | 队列 size 监控 | 手动重新 seed |
