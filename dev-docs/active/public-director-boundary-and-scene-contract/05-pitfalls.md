# 05 Pitfalls — T-094

## Do-not-repeat summary
- 不要把导演层和 persona runtime 合并成同一个“万能 prompt 对象”。
- 不要让 `private_chat` 或 owner 回复后的 `proactive_dm` 继续消费 `layer_showrunner`。
- 不要把热点、活动或关系推进写进长期 persona；这些都属于 overlay。

## Historical log
- 2026-03-13
  - symptom: `PromptScene`、director 入口和真实写入面在 repo 中被混着使用，`scheduled_post` 与 `forum_post` 容易被当成同一层语义。
  - root cause: 现有 runtime 类型更偏模板调用场景命名，没有显式区分 selector surface、actor delivery surface 和 private surface。
  - what was tried: 先尝试继续沿用单一 `scene` 命名，但在 `scheduled_post -> forum_post`、`private_chat` 非导演化和 chatroom adaptor 三处都出现歧义。
  - fix/workaround: 在合同层显式拆成 `director_surface / actor_surface / private_surface` 三层词汇，并要求后续字段名必须带层级语义。
  - prevention note: 后续任何 schema、event、metadata、prompt variable 若只写 `scene` 而不注明层级，应视为 contract review blocker。
- 2026-03-13
  - symptom: `scene_binding_v1` 和 `LocalIntent` 初稿里包含“看起来灵活、实际上很危险”的宽字段，容易成为平行 showrunner backdoor。
  - root cause: 初稿为了快速收 contract，保留了 `applicable_surfaces[]`、`memory_scope='inherit'` 这类宽语义字段。
  - what was tried: 评估是否继续保留宽字段并依赖实现侧 discipline 收口，结论是不可靠。
  - fix/workaround: 把 binding 收成单挂载点模型；把 `LocalIntent` 的 memory/reference/opinion 边界改成显式枚举；把 overlay 补齐 source/facts/safety。
  - prevention note: 任何“为了灵活先留宽一点”的字段，只要它可能承载 director 全文语义，都应优先收窄而不是后补约束。
- 2026-03-13
  - symptom: `trigger_conditions`、`risk_override`、`target_ref` 这类字段如果保留 free-text 或弱类型，会把 selector 和 actor delivery 的关键语义悄悄推到实现代码里。
  - root cause: 文档级 schema 初稿更关注对象存在性，没有第一时间把“字段形状本身就是治理”这件事写死。
  - what was tried: 先接受宽字段，再通过说明文字约束；但 review 发现这仍会让 `T-095` 在 forum/scheduled_post/comment 三条链路里各自解释一版。
  - fix/workaround: 把 `trigger_conditions`、`risk_override` 收成枚举，把 `target_ref` 收成 discriminated union，并加上按 `delivery_surface` 的可用形状约束。
  - prevention note: 任何会影响 selector 过滤、write target 或 actor reference 范围的字段，都不应以“string or optional bag”形式进入冻结合同。
- 2026-03-13
  - symptom: `env-contractctl generate` 首次执行失败，看起来像是新 feature flag 导致 env contract 断裂。
  - root cause: 失败原因不是新增 flags，而是 repo 先前一直缺少 `env/secrets/dev.local.ref.yaml`，导致 `dev.local` 环境的 required secret refs 校验无法通过。
  - what was tried: 先检查生成脚本，再回看 `03-validation-log.md` 的 redacted 错误输出，确认缺口集中在 `DATABASE_URL`、`JWT_SECRET`、`SERVICE_AUTH_SECRET` 等既有 secret refs。
  - fix/workaround: 新增 `env/secrets/dev.local.ref.yaml`，沿用 `env://...` 本地 backend 引用模式补齐 secret refs，然后重新执行 validate/generate。
  - prevention note: 之后凡是改 `env/contract.yaml`，先跑一次 `env-contractctl validate`，不要等到生成步骤失败后再排查基线缺口。
- 2026-03-13
  - symptom: 新增 feature flag 虽然写进了 config/env contract，但 scene-pool export/rotation 实际仍无条件输出 v2，导致“默认关闭”只停留在文档层。
  - root cause: 实现时把合同投影逻辑直接接到了 dist/export 主路径，却没有把 rollout gate 一起接进真正的行为分支。
  - what was tried: 先通过测试验证 v2 payload 是否正确，再回看评审意见，确认问题不在 payload 内容，而在默认行为被悄悄改写。
  - fix/workaround: 把 v2 dist/export/rotation 改成要求 `FF_PUBLIC_DIRECTOR_CONTRACT_V1 && FF_SCENE_POOL_ASSET_OPS_V1` 同时打开，flag-off 时完全回退到 legacy v1 payload。
  - prevention note: 后续凡是引入 feature flag，必须补一条“flag-off 兼容行为”测试，不能只测 flag-on happy path。
- 2026-03-13
  - symptom: 为了支持私域去导演化而放松 `PromptEngine` placeholder 校验后，所有模板都可能静默吞掉 optional placeholder，错误暴露时机变晚。
  - root cause: 局部边界例外被做成了全局 schema 规则，导致 private fix 影响了公域 prompt 合同的 fail-fast 特性。
  - what was tried: 先依赖 schema.required 收口，但 review 发现 registry 里很多真实占位符本来就不是 required。
  - fix/workaround: 恢复全局严格校验，只对 `agent-private-chat-reply@1` 和 `agent-proactive-dm-opening@1` 在 private boundary flag-on 时允许缺省 `layer_showrunner`。
  - prevention note: 之后凡是为了兼容某条链路而放宽 contract，优先做 callsite-scoped allowlist，不要先改全局校验器。
