# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要只存结果，不存 evidence snapshot。
- 不要让 report/appeal 直接改内容状态，必须进入 case/review。
- 不要把 repo 里的 MVP baseline 误记成 `T-089` 已完成。
- 不要把 `policy_snapshot` 按 hash 跨对象复用；相似文本可以共用检索逻辑，但不能共用审计实体。
- 不要把 provenance/config 或 hot-topic/kill-switch 需求吸回 `T-089`，边界必须留给 `T-090` / `T-091`。
- 不要让 deletion/privacy request 绕过 case 和 action log。
- 不要把 `claim/lock`、reopen、share export 只写成 contract，不补负路径测试；这类 foundation invariant 会在 happy path 全绿时继续潜伏。

## 2026-03-12 — T-089 lifecycle/lock hardening
- Symptom:
  - `claimTask()` 可被第二个 operator 直接覆盖。
  - `assignCase()` 可把已结案 case 直接改回活跃状态。
  - `reopenCase()` 可对已打开 case 重复执行，持续创建 `REOPENED_REVIEW` task。
  - `share` evidence export 仍带出 `claim_token` 和 assignee metadata。
- Root cause:
  - 初版 foundation 只覆盖了 happy path，缺少 lifecycle state guard 和 share export 的完整 redaction key set。
- What was tried:
  - 先通过 code review 对照 `T-089` acceptance/invariant，定位 claim/lock、lifecycle、share export 三类 contract 漏洞。
- Fix/workaround:
  - 在 `ReviewService` 中补 `case is not assignable`、`case is not resolvable`、`case is already open`、`task is already claimed` 校验。
  - `share` export 补 redaction：`claim_token`、`assigned_to_user_id`、`previous/from/to_assignee_user_id`。
  - admin UI 同步禁用 closed/open 不合法动作，并新增负路径测试。
- Prevention note:
  - 以后凡是把 task/case workflow 标成 foundation 完成，必须同时补：
    - 竞争态测试：重复 claim / transfer / release。
    - 生命周期测试：closed case assign/resolve、open case duplicate reopen。
    - 数据边界测试：share/export 不泄露 operator-only metadata。
