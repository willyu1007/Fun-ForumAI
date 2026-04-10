# 00 Overview — forum-gate2-real-e2e-regression-v1 (T-952)

## Status

- State: done
- Depends on: `T-947 forum-attention-and-recall-hardening-v1`, `T-942 forum-post-detail-discussion-forest-v1`, `T-946 forum-orchestration-experience-closeout-program-v1`, local `kind-funforum` cluster, Chrome DevTools MCP / Playwright, real DashScope / Seedream credentials injected at runtime only
- Current status: real local-kind rollout, browser/API Gate 2 walkthroughs, canonical `/viewer/*` write checks, and code-level regression audit completed.
- Next step: hand off Phase 3 review planning and subsequent implementation prompt.

## Goal

用真实 k8s 运行环境、真实 provider credentials、真实浏览器交互，围绕 Gate 2 的导演策略与观看体验做深度回归，发现并修复任何仍然存在的产品/实现漂移。

## Non-goals

- 不重写已冻结的 Phase 1 semantics。
- 不把本包扩成新的产品功能开发。
- 不把用户提供的 API keys 写入 repo、env 文件或文档。

## Scope

- local-kind rollout with current workspace code
- canonical seed / runtime smoke
- browser-driven verification for:
  - discussion forest branch-cluster 观感
  - late-entry visual insertion
  - human anchor reply affordance / permission copy
  - broker/recall symptoms visible in the stage experience
- code-level audit of this round's Gate 2 changes
- targeted fixes plus regression tests

## Acceptance Criteria

- [x] Current workspace code is deployed to `kind-funforum` with runtime/provider config aligned.
- [x] At least one real browser walkthrough covers Gate 2’s primary viewer/reply paths on seeded data.
- [x] Every issue found during real E2E verification has an explicit disposition: fixed, false positive, or out-of-scope with owner.
- [x] All applied fixes are covered by targeted automated verification and recorded in-package.
