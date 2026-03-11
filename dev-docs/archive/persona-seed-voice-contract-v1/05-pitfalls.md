# 05 Pitfalls — T-063

## Do-not-repeat summary
- 不要把 `style` 继续描述为“人格本体”。
- 不要让 `agent.model` 与 `voice` 同时成为运行时权威。

## 2026-03-08 - 当前 repo 的身份语义混杂
- Symptom: `agent.model`、`config_json.persona`、`style` 都在不同路径参与“角色是谁”的定义。
- Root cause: 历史上身份、表达和调用路由逐步叠加，没有形成统一 authority contract。
- What was tried: 基于当前代码路径梳理 identity、prompt、provider 的真实输入点。
- Fix/workaround: 单独建立 `T-063`，先冻结 authoritative contract。
- Prevention note: 后续任何人格相关实现，必须先声明它消费的是 config state 还是 runtime state，而不是直接读取 legacy 字段。

## 2026-03-08 - config 持久化不能再走 fire-and-forget 成功假象
- Symptom: PG 模式下创建 agent 后如果 `agent_configs` 写入失败，接口仍可能返回 201，且当前进程内 cache 会掩盖真实丢数，直到重启才暴露。
- Root cause: `AgentService.createAgentPersisted()` 之前先创建 agent，再调用 config repo 的异步 `create()`；repository 内部先写 cache、后 fire-and-forget DB。
- What was tried: 复盘 create path、PG repository 和缓存更新顺序，并补充失败回滚测试。
- Fix/workaround: 为 repo 增加 `createPersisted()` / `deletePersisted()` 能力；service 在 PG 路径等待 config 真正落库，失败则回滚 agent。
- Prevention note: 任何需要宣称“已持久化”的 service API 都不能依赖 fire-and-forget repository 方法，尤其在 cache 存在时。

## 2026-03-08 - config patch 必须先 merge 再 sanitize
- Symptom: 只想 patch `voice` 或 `chat/style` 的局部配置时，已有 `personaSeed/ownerStylePins` 会被默认值覆盖。
- Root cause: `sanitizeIdentityConfig()` 是“补齐并规范化”函数，不是“保留现状”的 patch 函数；直接对局部 payload 调用它会丢失未提交字段。
- What was tried: 审查 `/agents/:id/config`、style patch、chat-config patch 等共用路径，并补充 partial merge 回归测试。
- Fix/workaround: `AgentService.updateConfig()` 现在先读取最新 config，做深合并，再调用 `sanitizeIdentityConfig()`。
- Prevention note: 后续任何 config patch 路径都必须明确区分“replace entire document”和“merge patch”；默认不能把 sanitize 当 merge 用。
