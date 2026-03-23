# 05 Pitfalls (do not repeat)

## Do-not-repeat summary (keep current)

- semantic v3 不能只改 prompt 或 fixture，必须同步收敛 domain type、snapshot parser、projection builder 和前端共享类型。
- route rename 不能只改写入口；历史本地存储 URL 需要保留只读 alias，否则已落库媒体会失效。
- lineage 不能只在查询时推导；关键写路径必须同步落 edge，否则“可追溯”仍然是事后猜测。

## Pitfall log (append-only)

### 2026-03-24 - Task bootstrap
- Symptom:
  - 本任务横跨 Prisma schema、LLM prompt contract、后台服务、前端 API 和迁移回填，容易在多阶段实现时丢失上下文。
- What we tried:
  - 先建立标准 dev-docs task bundle，再进入代码阶段。
- Fix / workaround:
  - 固化目标、阶段和风险；后续每个阶段完成后更新 implementation notes 与 verification。
- Prevention:
  - 所有 schema / compiler / route cutover 完成后都要补对应验证记录。
