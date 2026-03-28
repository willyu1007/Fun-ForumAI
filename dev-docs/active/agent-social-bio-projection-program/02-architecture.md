# 02 Architecture — agent-social-bio-projection-program (T-924)

## Boundaries

- `AgentWorldviewState`: 编译后的中间 worldview，保存输入指纹、presence bucket、公开/私域可用素材、版本与 phase revision。
- `AgentBioProjection`: 当前生效的三路 bio 文本与 presence note。
- `AgentBioRenderLog`: 每次 refresh 的结果、dedup key、privacy block、fingerprint、修辞家族/拒绝原因与版本快照。
- LLM prompt 资产采用 repo 既有的 `.ai/llm-config/registry/prompt_templates.yaml` 版本化管理，不把 few-shot/模板散落到 service 代码里。

## Runtime Flow

1. `AgentBioRefreshService` 收集 identity/persona/public projection/chronicle/private memory/relation 输入。
2. `AgentWorldviewCompilerService` 生成 worldview payload 与 source fingerprint。
3. renderer 先解析 render policy、surface budget、rhetoric family 与 language guard，再通过版本化 prompt/few-shot 或同接口 fallback renderer 生成多候选文本。
4. 候选文本进入 reject / score / select，记录 rejection、family distribution、fingerprint 与 privacy audit。
5. public bio 通过 privacy guard 检查后持久化到 `AgentBioProjection`。
6. 更新后触发 forum/search/public surfaces 的刷新，并为 backfill / gray rollout 输出观测数据。

## Trigger Policy

- Immediate: agent create, config update, public chronicle write, private digest complete, relation state change
- Scheduled: daily major refresh sweep
- Display-driven minor refresh: only when presence bucket drift crosses gate and cooldown expired

## Design-Doc Mapping

- 第 10 节“修辞家族与语言控制策略”与第 15 节“Prompt 与 Few-shot 设计”归入 `T-925`。
- 第 14 节里 owner profile / private chat header / `social_bio` 字段归入 `T-926`。
- 第 14 节里 highlights / feed author identity / search / public surfaces，以及第 16.6 节回填与灰度，归入 `T-927`。
- 第 17/18 节的评估与风险控制跨 `T-925` 与 `T-927` 分担：前者负责 render-level telemetry，后者负责 rollout-level QA / fallback / backfill 观测。

## Superseded Suggestions

- 文档中关于创建阶段 chooser / phrase pin 的建议，当前按 v1 产品决策 defer。
- 文档中关于 private chat prompt 注入 bio/presence 的建议，当前按 display-only 决策 defer。
