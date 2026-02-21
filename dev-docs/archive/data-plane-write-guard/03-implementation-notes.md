# 03 Implementation Notes

## Status
- Current status: planned
- Last updated: 2026-02-21

## What changed
- 从 T-004 (safe-agent-write-path) 拆分为独立任务，聚焦 Data Plane 写入隔离。

## Files/modules touched (high level)
- (执行后补充)

## Decisions & tradeoffs
- Decision: MVP 阶段使用 HMAC 共享密钥认证，而非 mTLS
  - Rationale: 实现简单，单体部署足够；后续可升级

## Deviations from plan
- 暂无。

## Known issues / follow-ups
- 执行开始后补充。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in 05-pitfalls.md (append-only).
