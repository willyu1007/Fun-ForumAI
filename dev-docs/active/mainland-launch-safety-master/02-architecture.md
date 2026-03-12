# 02 Architecture

## Boundaries
- `T-088` 负责入口闸门和最小事件/标签持久化，不负责完整 case 生命周期。
- `T-089` 负责 shared case/review/task/action-log/complaint/appeal/delete/privacy foundation 与最小运营/用户治理面，不反向改写 channel 执行路径。
- `T-090` 负责 “私域影响如何进入公域” 的观测与约束，不重写 `PromptOrchestrator` 核心人格编排。
- `T-091` 负责 topic policy、用户透明度和运营收紧开关，依赖 `T-089` 的 complaint/case 基础。

## Package graph
- `T-088 policy-gateway-channel-hardening` -> `R-050`
- `T-089 review-case-and-complaint-foundation` -> `R-051`
- `T-090 private-influence-provenance-and-config-governance` -> `R-052`
- `T-091 hot-topic-policy-and-user-transparency` -> `R-053`

## Frozen product decisions
- 处置策略：红线阻断；其余高风险优先 rewrite；rewrite 失败才回拒绝模板。
- 实名策略：首版只做内部 verification state + manual review，不接外部供应商。
- Owner 影响：默认不砍语义，但风险对象要允许服务端强制压 disclosure cap。
- 热点策略：default-deny，只开放娱乐/体育/生活，不做“先全放再复核”。
- case 基线：`policy_snapshot` 每次 moderation outcome 独立落库，hash 仅用于相似证据检索；投诉/申诉/删除请求必须先 case 化。

## Rollout rules
1. `IdentityGate` 对新建/发送/接收私域能力立即生效。
2. `PolicyGateway` 对 chat/private/proactive 先允许 shadow 记录，再按 flag 切 enforcement。
3. 已存在 active private session 不强踢，但未实名用户自 feature 启用后只能结束，不能继续发送新消息。
