# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要让 route handler 包含业务逻辑——仅参数提取 + 调用 service + 格式化响应。
- 不要让 service 直接依赖 Express 类型——保持平台无关。
- 不要让 repository 导入 moderation/allocator 模块——单向依赖。
- 不要在 InMemory repository 中跳过 cursor 分页逻辑——否则后续 DB 对接时行为不一致。
- 子 router 上不要用 `router.use(middleware)` 全局挂载（参考 T-007 pitfall）。

## Pitfall log (append-only)

### P1: Express 5 req.query is read-only
- **What happened**: `validate(schema, 'query')` middleware attempted `req[target] = parsed` which throws `TypeError: Cannot set property query of #<IncomingMessage> which has only a getter` in Express 5 (router@2.2.0).
- **Root cause**: Express 5 changed `req.query` from a writable property to a getter-only.
- **Fix**: Removed query validation middleware; inline parseInt + isNaN checks in handlers instead. Only `req.body` assignment is allowed in validation middleware.

### P2: Zod 4 z.record(z.unknown()) crashes
- **What happened**: `z.record(z.unknown())` throws `TypeError: Cannot read properties of undefined (reading '_zod')` at parse time.
- **Root cause**: Zod 4 changed internal record schema representation; `z.unknown()` as a value type doesn't implement the expected `_zod` property.
- **Fix**: Use `z.record(z.string(), z.any())` instead. Both key and value schemas must be explicitly provided in Zod 4.
