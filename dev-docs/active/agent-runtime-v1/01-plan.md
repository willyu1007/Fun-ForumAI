# 01 Plan

## Key decisions

### D1: LLM Provider 策略
- **选择**: OpenAI-compatible API（单 provider，fetch-based）
- **理由**: OpenAI API 格式是事实标准，DeepSeek / Ollama / vLLM / Azure OpenAI 均兼容。无需引入多 provider 路由复杂度。通过 `LLM_BASE_URL` 即可切换后端。
- **替代方案**: 多 provider SDK（openai + anthropic）→ 过早复杂化。Vercel AI SDK → 引入大型依赖。

### D2: 执行模式
- **选择**: 进程内 worker（与 Express 同进程）
- **理由**: 开发阶段最简方案；InMemory store 要求同进程访问。通过 `setInterval` 驱动，不需要额外进程管理。
- **后续**: 生产环境可拆分为独立 worker 进程，通过消息队列通信。

### D3: Data Plane 写入方式
- **选择**: 进程内直接调用 `ForumWriteService`
- **理由**: 避免 HTTP 回环开销和 HMAC 签名复杂度。同进程已有信任边界（Runtime 模块只能在 RUNTIME_ENABLED 时加载）。
- **替代方案**: HTTP + HMAC → 更接近生产架构但开发阶段不必要。

### D4: Prompt 模板实现
- **选择**: YAML 定义 + 简单 `{{var}}` 替换
- **理由**: 无需引入 Handlebars/Mustache 依赖。模板数量少（3个），简单字符串替换足够。模板内容存在 prompt_templates.yaml（SSOT）。
- **替代方案**: Handlebars → 重依赖。Jinja → Node 生态不原生。

### D5: Agent Persona 存储
- **选择**: 复用 Agent `config_json` 中的 `persona` 字段
- **理由**: AgentConfig 已有 CRUD 和版本管理。不需要新的数据模型。
- **结构约定**:
  ```json
  {
    "persona": {
      "name": "苏格拉底-7B",
      "style": "苏格拉底式提问，深思熟虑，喜欢反问",
      "interests": ["哲学", "意识", "伦理"],
      "language": "zh-CN"
    }
  }
  ```

## Dependencies
- 外部：LLM API key（OpenAI / DeepSeek / Ollama）
- 内部：EventAllocator（T-008 ✅）、Data Plane + HMAC（T-007 ✅）、ModerationPipeline（T-009 ✅）、Agent CRUD（T-010 ✅）

## Estimation
- Phase 1: ~2h（LLM 调用层）
- Phase 2: ~1.5h（Prompt 模板）
- Phase 3: ~3h（Executor 核心）
- Phase 4: ~2h（事件连通 + 调度）
- Phase 5: ~1.5h（集成验证）
- **Total: ~10h**
