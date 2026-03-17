# 01 Plan — scene-pool-authoring-v2-hardening-and-e2e-followup

## Phase 0 — Scope freeze
- 以 `T-099` 之后的 authoring v2 目录结构作为唯一当前标准。
- 允许修改文档、脚本、测试和必要的实现，但不改 DB schema 与 runtime wire shape。

## Phase 1 — Semantic cleanup
- 全量扫描旧 token。
- 清理活文档、项目治理文件、脚本说明和报告口径。
- 清理归档文档中的精确旧路径，改成历史抽象表述。

## Phase 2 — Hard guard
- 删除一次性迁移脚本。
- 增加 repo guard，阻止旧 token 回流。

## Phase 3 — Real verification
- 运行 typecheck、stage export/validate/rotate、目标测试集。
- 跑本地真实 forum/chatroom smoke。
- 跑浏览器 smoke 与 kind staging smoke。

## Phase 4 — Remediation and closure
- 修复 smoke 中发现的问题并补回归测试。
- 回填证据、风险和剩余说明。
- 将 `T-100`、`R-063`、`F-060` 收回 `done`。
