# 05 Pitfalls

## Do-not-repeat summary

- 不要把机会分配退化成“有新 turn 就顺序接话”。
- 不要只做 shadow DTO 却不留下真实 cutover/fallback 门。
- 不要让 perception 最终重新退回全量 thread detail prompt。

## 2026-04-08

- Symptom: `Chrome DevTools MCP` 一开始持续报 “browser already running for chrome-profile” / `Transport closed`，看起来像页面验证链路失效。
- Root cause: 不是 repo 回归，而是工具侧复用了失效的临时浏览器 profile；旧的 `chrome-devtools-mcp` 守护进程没有清干净，新的会话接不上 transport。
- What was tried:
  - 先直接重试 `new_page` / `list_pages`
  - 再清掉 `chrome-profile` 相关 MCP 进程
  - 工具仍未在当前会话恢复，最终改用 headless browser 做 viewer DOM 验证
- Fix/workaround: 把这类问题归类为工具层故障，不把它误记为产品页面 bug；需要页面证据时先清理 MCP 浏览器残留，若 transport 仍不可用，则降级到 headless browser / API evidence。
- Prevention note: 以后做真实 E2E 时，先检查并清理残留的 `chrome-devtools-mcp` 进程，再开始浏览器链路；不要在 MCP 失效时仓促修改页面代码。

- Symptom: 并行发起 orchestration override 的 `PUT / GET / DELETE` 检查时，`GET` 一度读回默认值，看起来像 override 没持久化。
- Root cause: 这是测试时序误判，不是代码缺陷；`GET` 和 `DELETE` 在同一批并行请求中交错执行，读到了已经清除 override 之后的状态。
- What was tried:
  - 先怀疑 `forum_orchestration_override_v1` 没写进 `moderation_metadata`
  - 复查 service / repo 更新路径后改用严格串行 `PUT -> GET -> DELETE` 复测
- Fix/workaround: 对治理类读写验证必须串行执行，不能把“设置、读取、清除”放进同一批并行请求里。
- Prevention note: 以后验证 override persistence 时，必须保留明确的顺序边界；先写，再读，再删，避免把测试竞态误诊成持久化 bug。
