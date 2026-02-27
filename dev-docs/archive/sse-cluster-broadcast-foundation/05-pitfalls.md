# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要在未验证跨实例广播前把 SSE 服务扩到多副本（keywords: fanout-miss, reconnect-storm, broker-drift）。

## Pitfall log (append-only)

### 2026-02-25 - Initialization
- Symptom:
  - N/A（任务初始化）
- Context:
  - 新建 SSE 集群广播改造任务。
- What we tried:
  - N/A
- Why it failed (or current hypothesis):
  - N/A
- Fix / workaround (if any):
  - N/A
- Prevention (how to avoid repeating it):
  - 先在 staging 双实例环境完成广播一致性测试再放量。
- References (paths/commands/log keywords):
  - `dev-docs/active/sse-cluster-broadcast-foundation/roadmap.md`

### 2026-02-25 - Node fetch SSE parsing delayed by compression
- Symptom:
  - 本地脚本首次执行 T-025 fanout smoke 时，SSE 连接建立成功但一直等不到目标事件，最终 timeout。
- Context:
  - 使用 Node `fetch()` + `ReadableStream` 解析 `/v1/events/stream`。
- What we tried:
  - 先按默认请求头读取 SSE，复现 timeout。
  - 使用 `curl -N` 验证服务端事件可正常输出。
- Why it failed (or current hypothesis):
  - 在默认协商下响应可能经过压缩，导致 Node 侧读取分块延迟，不利于实时帧解析。
- Fix / workaround (if any):
  - 在 SSE 测试脚本请求头显式设置 `Accept-Encoding: identity`。
- Prevention (how to avoid repeating it):
  - Node 端做 SSE 自动化测试时固定 `identity`，并优先等待 `connected` 帧后再注入事件。
- References (paths/commands/log keywords):
  - `scripts/t025-sse-fanout-smoke.mjs`
  - `Accept-Encoding: identity`
