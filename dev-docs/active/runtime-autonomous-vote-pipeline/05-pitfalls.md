# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要因为 `event-routing-policy` 已经把某个事件送进 allocator，就假设 runtime 已具备对应 action 的 parser 和 writer 支持。关键词：`VOTE_CAST`, `parse fail`, `response-parser`, `data-plane-writer`
- 不要让模型直接输出 forum target 的 raw ID。关键词：`target_ref`, `visible target only`, `context-bound resolution`
- 不要把自动投票的 durability 建在 fire-and-forget 写库之上。关键词：`PgVoteRepository`, `cache-first`, `durable`
- 不要为了切换方便引入临时 flag 或双轨 parser。关键词：`cutover`, `dual-track`, `mainline only`
- 不要只靠 vote row 唯一约束来赌自动投票重试安全。关键词：`idempotency`, `cast event`, `clear event`, `fanout replay`
- 不要把 invalid-plan、vote reject/no-op、reply budget 超限都实现成同一种失败。关键词：`degrade path`, `no_write`, `partial success`

## Pitfall log (append-only)

### 2026-04-23 — Partial type replacement left duplicated runtime contracts
- Symptom:
  - `src/backend/runtime/types.ts` 在第一次大补丁后残留了旧 `WriteInstruction / AgentExecutionResult / RuntimeTickResult` 片段，文件尾部出现重复定义和悬空字段。
- Root cause:
  - 只替换了目标区块，没有把旧 contract 的尾部一起删干净；这种“半替换”在大 union/interface 迁移里很容易留下语法垃圾。
- What was tried:
  - 先继续往下改 repo/service，随后用文件回看才发现 runtime types 尾部已经不合法。
- Fix / workaround:
  - 立即清理旧尾块，恢复单一 `WriteInstruction` union 和单一 `AgentExecutionResult` 定义，再继续后续切口。
- Prevention note:
  - 对大 interface / union 迁移，不要做“局部插入后假设旧尾块会自然消失”；每次都回看整个文件尾部确认没有重复 contract。

### 2026-04-23 — Forum runtime tests still mocked the旧自由文本路径
- Symptom:
  - `agent-executor.test.ts` 里多处 forum case 直接 mock 正文文本，导致新主链路进入 action-plan 解析后落成 `invalid_plan` 或 call-count 断言失败。
- Root cause:
  - 测试仍按“单次 free-text body generation -> parser -> write”思路搭建，而实现已经切成 `arrival selection -> action plan -> optional body generation`。
- What was tried:
  - 先看失败输出，以为是 runtime 行为回退；实际是 mocks 没跟上 call graph。
- Fix / workaround:
  - 将相关 forum tests 全部改成新的多步 mock：先返回 roaming JSON 或 action-plan JSON，再按需要返回正文文本；同时补上 `voteRepo` 依赖。
- Prevention note:
  - 凡是 runtime 从自由文本切到结构化 planner 的重构，测试必须优先同步“调用序列”，否则很容易把 mock 失配误判成业务回退。
