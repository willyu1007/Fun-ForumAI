# 05 Pitfalls — T-064

## Do-not-repeat summary
- 不要继续允许 feature code 直接传 raw model 作为长期调用方式。
- 不要把 `.ai/llm-config` 继续当成“仅文档模板”，而不作为 runtime authority。

## 2026-03-08 - 当前可见生成链路存在多重调用面
- Symptom: forum/chat/scheduler 常走全局默认模型，private/proactive 又显式传 `agent.model`。
- Root cause: runtime 从未形成 single calling surface，prompt registry 也未在运行时强制 version contract。
- What was tried: 对比 `llm-client`, `prompt-engine`, runtime executor 与私聊/聊天服务的现有调用路径。
- Fix/workaround: 单独建立 `T-064`，先冻结 gateway/routing/prompt version 合同。
- Prevention note: 后续任何新增 LLM 调用路径，必须先声明其 gateway surface 与 profile/ref 来源，不能直接拼接 provider/model 调用。

## 2026-03-08 - Prompt version 强化后 dev/debug 默认变量不足
- Symptom: `POST /v1/dev/prompts/render` 在启用 `template_version` 和 placeholder 校验后，部分场景从 200 变成 400。
- Root cause: debug route 的默认变量集没有覆盖 `agent-create-post` 等模板新增要求的 schema/placeholder 字段。
- What was tried: 先仅升级 `PromptEngine`，随后通过路由测试定位缺失字段。
- Fix/workaround: 为 dev route 默认变量补齐 `recent_posts`、`community_candidates`、`inclination_injection`、`inclination_media_url`、`topic` 等字段，并在响应中返回 `prompt_template` 元数据。
- Prevention note: 之后新增模板变量时，必须同步更新 dev render 默认变量和 prompt-engine 测试用例。

## 2026-03-08 - inventory guard 扫描自身实现文件导致假失败
- Symptom: `callsite-inventory.test.ts` 在 remediation 版中误报新增了 8 个 `promptEngine.render` 调用。
- Root cause: textual guard 在扫描 `src/backend/**` 时把 `src/backend/llm/callsite-inventory.ts` 自己也当成业务代码，匹配到了 inventory 常量里的字符串字面量。
- What was tried: 先核对业务文件 direct call 数量，再对比扫描结果定位到 inventory 实现文件本身。
- Fix/workaround: 在 guard 中显式排除 `src/backend/llm/callsite-inventory.ts`，把 textual count guard 和 logical inventory semantics 分离。
- Prevention note: 之后新增 repo-wide grep guard 时，先确认 metadata/fixture 文件不会被自身匹配污染。

## 2026-03-08 - fail-fast 测试最初只抛出原生 ENOENT
- Symptom: `PromptEngine` 缺失 registry 文件时，测试收到的是原生 `ENOENT`，不是 `RegistryResolutionError`。
- Root cause: `registry-loader.ts` 只包装了 YAML parse/schema 失败，没有包装最前面的文件读取错误。
- What was tried: 先检查 `PromptEngine` 构造路径，再向下追到 `readFileSync` 的异常边界。
- Fix/workaround: 在 `parseYamlFile()` 中统一包装文件读取错误，转成 `LLMGatewayContractError('RegistryResolutionError', ...)`。
- Prevention note: 之后所有 registry/file-backed loader 都要把 read/parse/validate 三层错误统一映射到 contract error，而不是混出原生 I/O 异常。
