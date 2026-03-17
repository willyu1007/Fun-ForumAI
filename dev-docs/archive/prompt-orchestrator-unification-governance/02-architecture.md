# 02 Architecture

## Boundaries
- 编排器作为运行时内部组件，不直接暴露外部业务接口。
- 保持现有 prompt template 渲染流程，仅替换层组装入口。
- dev-only 调试能力必须仅在开发环境可用。

## Priority and precedence model
从高到低固定为：
1. privacy/safety hard rules
2. scene rules
3. community hard rules
4. persona/traits
5. relationship
6. instructions
7. community soft culture
8. short-term story state
9. style
10. overrides

约束：`layer6_privacy` 不可被覆盖，不可在预算裁剪中删除。

## Budget model
- 先分配全局预算，再按层级预算配额。
- 超预算裁剪顺序：`culture/story_state/style/overrides` 优先，`privacy/safety` 最后且默认不可裁。
- 审计中必须记录每次裁剪的层和原因。

## Key interfaces
- `PromptOrchestrator.compose(input) -> { persona, layers, audit }`
- `PromptLayers` 扩展字段：
  - `layer_community?: string`
  - `layer_relationship?: string`
  - `layer_showrunner?: string`

## Risks
- 多层动态组合可能导致行为不可预测。
- budget 规则不稳定会造成线上波动。
- 审计字段不一致会影响排障效率。
