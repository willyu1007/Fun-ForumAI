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

### 2026-04-10 - Legacy cleanup must separate dead code from owned compat
- Symptom:
  - 全仓 grep 能同时扫出真正零引用模块、受控迁移 fallback、以及仍在 runbook / contract 中服役的 compat wrapper。
- Context:
  - 本轮目标包括“清理冗余/死代码”和“检查双轨语义”。
- What we tried:
  - 先做 consumer grep，再对照 runbook、OpenAPI、active task packet 判断是否仍有 owner / deprecation timeline。
- Why it failed (or current hypothesis):
  - 只看命名中的 `legacy` / `compat` 很容易误删仍在服役的兼容面，例如 `/v1/health` 或 metadata rewrite fallback。
- Fix / workaround (if any):
  - 仅删除“零引用且无 contract 责任”的文件，或“无消费者的过渡字段”；其余 compat 面只记录 owner 与保留理由。
- Prevention (how to avoid repeating it):
  - 对每个候选 legacy 面先回答三件事：有没有 consumer、有没有 contract、有没有 owner/deprecation timeline。
- References (paths/commands/log keywords):
  - `rg -n "rule-registry|prisma-singleton|legacy_thread_excerpt" src docs/context`
  - `ops/deploy/handbook/runbooks/deployment-mainline.md`
  - `src/backend/routes/read-api.ts`
