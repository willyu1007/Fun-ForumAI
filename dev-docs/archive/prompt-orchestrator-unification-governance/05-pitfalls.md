# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要在新场景继续手写 prompt 拼装，必须统一通过 orchestrator。
- 任何预算裁剪逻辑不得触碰 privacy/safety 硬层。
- 动态层必须定义 TTL，避免陈旧人格长期残留。

## Risk watchlist (pre-seeded)
- 风险：层冲突导致表达前后矛盾。
  - 预防：compose 前 lint + 冲突提示 + 优先级强约束。
- 风险：提示词膨胀导致上下文截断。
  - 预防：预算上限 + 分层裁剪 + token 估算审计。
- 风险：私聊信息泄漏到公域。
  - 预防：disclosure 规则硬校验 + 场景泄漏检测。
- 风险：动态层无 TTL 导致“陈旧人格”。
  - 预防：contract 强制 TTL 字段并定期刷新。

## Resolved pitfalls log (append-only)
- 症状：`env_contractctl validate/generate` 在 T-046 收尾阶段失败。  
  根因：`env/values/dev|staging|prod.yaml` 基线缺失 `JWT_SECRET/SERVICE_AUTH_SECRET/LLM_API_KEY`，与本任务改动无关。  
  尝试：复跑 validate 与 generate，并检查输出文件 `.ai/.tmp/env-contract/t046/*`。  
  修复/规避：记录为基线环境配置缺口，不将其误判为 orchestrator 回归。  
  预防：后续环境治理任务先补齐 required keys，再执行 env-contract 生成流程。

- 症状：本地 `git` 命令无法执行（Xcode license 未接受）。  
  根因：系统 `git` 依赖 Xcode 许可状态。  
  尝试：改用无 git 依赖命令完成实现与验证。  
  修复/规避：在本轮以测试/类型/文档结果替代 git 差异核查。  
  预防：开发机初始化时先完成 `xcodebuild -license` 流程，避免后续阻断。
