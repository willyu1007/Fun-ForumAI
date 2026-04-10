# 01 Plan

## Phases
1. 固化 review 发现与全量失败面的根因映射。
2. 逐项修复前后端回归并补齐最小必要测试/fixture。
3. 先跑定向验证，再跑全套校验链，直到没有阻塞项。

## Detailed steps
- 建立任务 bundle，并同步 project governance。
- 修复 `ForumReadService` 的 participation contract / lifecycle fallback，恢复 data-plane 与 public observation 路径。
- 修复媒体资产 promote/demote 的 URL 解析与错误语义。
- 修复前端 lazy import typing、lint 阻塞和 `DiscussionForest` fixture。
- 收敛 `semantic-projection` 与 `FeedbackPage` 测试失败。
- 重新跑定向测试。
- 重新跑全套仓级校验：typecheck、lint、test、build、ui check、bundle check、db validate、launch gate、mobile、docker、web-playwright（若环境允许）。

## Risks & mitigations
- Risk: 读模型 fallback 过宽，掩盖真实的依赖装配错误。
  - Mitigation: 仅对可选参与契约和默认 lifecycle 做降级；保留明确的 attached runtime deps API。
- Risk: 媒体 URL 改成宽松解析后返回悬空链接。
  - Mitigation: 只在 owner control surface 使用 best-effort URL，保留真实文件读取路径不变。
- Risk: 为兼容旧测试数据引入过多临时字段。
  - Mitigation: 优先把兼容逻辑限制在 projection cue 构建层，避免向核心 domain 扩散。
