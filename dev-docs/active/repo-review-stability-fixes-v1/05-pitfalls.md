# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要只修测试表象；这轮失败里至少一半来自 service/read-path 的真实契约回归。
- `ForumReadService` 的可选依赖要么在构造时强制，要么提供默认回退，不能让 lightweight context 直接炸掉。
- owner media control 面不要把“URL 当前不可校验”误报成“资产不存在”。

## Pitfall log (append-only)

### 2026-04-10 - Initial review convergence
- Symptom:
  - typecheck、lint、test、launch gate 同时失败，难以判断修复顺序。
- Context:
  - 审查范围覆盖 forum read/write、media、frontend lazy imports、feedback 测试。
- What we tried:
  - 先把失败按根因聚类，再决定修服务还是修测试。
- Why it failed (or current hypothesis):
  - 多个失败由同一批近期 contract 变更串联引起，按命令逐个修会重复返工。
- Fix / workaround (if any):
  - 先收敛 4 个高优先级发现，再补剩余兼容性失败。
- Prevention (how to avoid repeating it):
  - 先建立“失败 -> 根因”映射，再进入改码。
- References (paths/commands/log keywords):
  - `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm verify:launch:ci`
