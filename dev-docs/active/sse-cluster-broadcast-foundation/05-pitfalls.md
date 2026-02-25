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
