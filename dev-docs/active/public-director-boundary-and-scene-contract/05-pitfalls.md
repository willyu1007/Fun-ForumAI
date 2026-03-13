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
