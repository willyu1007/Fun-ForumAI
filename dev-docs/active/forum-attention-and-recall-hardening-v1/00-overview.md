# 00 Overview — forum-attention-and-recall-hardening-v1 (T-947)

## Status

- State: done
- Depends on: `T-941 forum-semantic-lifecycle-projection-foundation-v1`, `T-943 forum-participation-contract-and-viewer-write-plane-v1`, `T-945 forum-semantic-llm-runtime-convergence-v2`, completed `T-944 forum-attention-opportunity-and-perception-full-cutover-v1`
- Current status: broker now consumes forest/local branch structure, recall is thread-scoped with live decay/quota telemetry, and the package review packet is closed for Gate 2.
- Next step: keep the package frozen as the orchestration baseline while `T-942` and Gate 2 consume the recorded broker/recall semantics.

## Goal

收口导演编排质量问题，使 forum orchestration 真正体现“agent 在局部看见、局部介入、局部回应”的观看心智，而不是只在共享 contract 上看起来正确。

## Non-goals

- 不重开 `T-944`，也不推翻其已经通过的 cutover/evidence。
- 不重做 chatroom 编排主链。
- 不新建持久化 orchestration store。

## Scope

- 让 broker 真正消费 `DiscussionForestProjection` / local branch 结构来选 anchor 与 source。
- 把 `reactive_recall_decay`、pair window scope、outsider/incumbent quota 做成真实生效策略。
- 修正过粗的 post attention metrics，使 duel risk / dominant share / entropy 不再只是静态人数启发式。
- 把相关 decision telemetry 明确化，避免“像是自然”只能靠主观判断。
- 建立面向自然感回归的 orchestration 指标面板，覆盖 spontaneity / branch entropy / duel risk 等关键维度。

## Acceptance Criteria

- [x] `AttentionOpportunityBroker` 在 branch revive、late entry、audience spike 等场景下，会显式消费 forest/local branch 信息，而不是只回退到 `event.turn_id` / `latest_turn_id`。
- [x] opportunity source 判定不再仅依赖粗粒度 `reason_badges` / participant count；至少关键 path 拥有结构化 source evidence。
- [x] `reactive_recall_decay` 在 recall 评估中真实生效，并有 regression test。
- [x] pair interaction window 至少 scoped 到 thread；不同 thread 的同一 pair 不再互相抑制。
- [x] incumbent recall 与 outsider/newcomer quota 的作用边界清晰分离，不再由单一 suppress 逻辑隐式代管。
- [x] recall telemetry 能解释：
  - 为什么 suppress
  - suppress 作用在哪个 scope
  - decay/outsider/newcomer quota 如何影响结果
- [x] duel risk / dominant share / branch entropy 等指标有统一语义字典，并进入后续观测面板。
- [x] spontaneity / branch entropy / duel risk 指标面板有明确 owner 输出，供产品和工程回归共用。
- [x] 本包完成后，不需要改动 public API version，也能显著改善导演层自然度。
