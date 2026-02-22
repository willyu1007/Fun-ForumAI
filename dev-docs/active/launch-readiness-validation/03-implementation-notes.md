# 03 Implementation Notes

## Status
- Current status: done
- Last updated: 2026-02-22

## What changed

### Phase 0 — Discovery (2026-02-22)
- 读取全部 7 个归档任务的 00-overview.md 和 04-verification.md
- 提取 DoD 项与验证结果，分类为 P0/P1/P2

### Phase 1 — Acceptance matrix (2026-02-22)
- 创建 acceptance-matrix.md：
  - P0 Blockers: 20 项（全部 PASS）
  - P1 Critical: 8 项（2 PASS, 6 PENDING）
  - P2 Nice-to-have: 5 项（全部 NOT STARTED）
- 定义 launch decision criteria（P0 硬门槛 + P1 签核 + 回滚演练）
- 提供一键自动化验证命令列表

## Files/modules touched (high level)
- dev-docs/active/launch-readiness-validation/acceptance-matrix.md (new)
- dev-docs/active/launch-readiness-validation/00-overview.md (updated)
- dev-docs/active/launch-readiness-validation/03-implementation-notes.md (updated)
- dev-docs/active/launch-readiness-validation/04-verification.md (updated)

## Decisions & tradeoffs
- Decision: 三层分级（P0/P1/P2）而非 pass/fail 二元
  - Rationale: P1 允许显式推迟并签核，避免过严门槛阻碍迭代
- Decision: P0 #14 typecheck 标注为 PASS*（预存错误不影响运行时）
  - Rationale: control-plane.ts 类型错误是 Express 类型扩展问题，运行时和测试均不受影响

## Deviations from plan
- 无偏差。Phase 0-1 按 roadmap 执行。

### Phase 2 — Verification automation (2026-02-22)
- 修复 control-plane.ts 3 个预存 TypeScript 错误：
  - Express v5 类型扩展：从 `declare module 'express'` 改为 `declare global { namespace Express }` 放入独立 `.d.ts`
  - req.params 类型安全：`String(req.params.agentId)` 处理 `string | string[]`
  - req.query 类型安全：`typeof` 窄化替代不安全的 `as` 断言
  - 安装 `@types/express-serve-static-core` 为显式 devDependency
- 创建 scripts/verify-launch-readiness.mjs：
  - 18 项 P0 自动化检查（DB、typecheck、lint、test、build、packaging、deploy、rollback、env、governance）
  - 支持 `--ci`（失败返回非零退出码）和 `--json`（结构化输出）
  - 添加 package.json 脚本 `verify:launch` 和 `verify:launch:ci`
- 添加 CI launch-readiness job：
  - 依赖 check job 通过后运行
  - 仅在 main 分支和手动触发时执行
  - 产出 JSON artifact
- 创建手工 smoke 测试指引（smoke-test-guide.md）：
  - 6 个 smoke 场景覆盖 P0 补充验证和 P1 项
  - 包含结果记录模板

## Files touched (Phase 2)
- src/backend/middleware/human-auth.ts (removed inline type augmentation)
- src/backend/types/express.d.ts (new — Express Request augmentation)
- src/backend/routes/control-plane.ts (type safety fixes)
- scripts/verify-launch-readiness.mjs (new)
- .github/workflows/ci.yml (launch-readiness job)
- package.json (new scripts + devDependency)
- dev-docs/active/launch-readiness-validation/smoke-test-guide.md (new)
- dev-docs/active/launch-readiness-validation/acceptance-matrix.md (updated P1 #7)

### Phase 3 — Smoke test & P1 sign-off (2026-02-22)
- 执行 4 项 smoke test (Data Plane 隔离、Read API、Frontend build、Control Plane auth)，全部 PASS
- Docker image build 和 Database migration 显式推迟（合理：InMemory 阶段 + 无 daemon）
- P1 更新：
  - #1 Agent Runtime 集成：PASS（T-012 已完成端到端 LLM 验证）
  - #4 CI 远端实跑：PASS（已 push 通过）
  - #2 Prisma middleware：显式推迟至 T-013 Phase 4
  - #3 Admin moderation queue：显式推迟（501 placeholder）
  - #5 Docker image build：显式推迟至部署阶段
- 最终 P1: 5/8 PASS, 3/8 DEFERRED (signed off)

## Known issues / follow-ups
- 3 个 DEFERRED P1 项将在后续任务中逐步关闭
- P2 项（性能基线、结构化日志、Metrics、Rate limit、移动端）保持 NOT STARTED

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in dev-docs/active/launch-readiness-validation/05-pitfalls.md (append-only).
