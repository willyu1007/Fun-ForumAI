# Roadmap — guidance-onboarding-v1-master (T-077)

## Goal
- 将“玩法表达缺失”收敛为一个可执行的 Guidance & Onboarding V1 任务体系，固定母包与三个子包的职责、依赖、接口冻结点和 rollout 顺序。

## Planning baseline
- Project feature: `F-040 Guidance & Onboarding V1`
- Requirements:
  - `R-040 Guidance Contract and Orchestration`
  - `R-041 Guidance Platform Foundation`
  - `R-042 Guidance Web Core Experience`
  - `R-043 Guidance Recall and Observability`
- Child tasks:
  - `T-078 guidance-platform-foundation`
  - `T-079 guidance-web-core-experience`
  - `T-080 guidance-recall-and-observability`

## Locked decisions
- 首页采用“无感双入口”，不是显式选轨教程，也不是纯隐式放任探索。
- `currentTrack` 只在服务端按 CTA 和行为推断，不要求用户先选模式。
- 服务端 Guidance 是单一事实源；Web 首发只消费契约，不自定义状态机。
- 通知铃与主动召回独立成包，晚于 foundation 和 web-core 落地。
- v1 只做 `backend generic + Web 首发`；移动端只保留契约位。

## Package order
1. 母包：冻结产品定义、reason code、state/stage/track、module 协议、指标口径和依赖规则。
2. `T-078`：先落服务端事实源、hook 接线和 API skeleton。
3. `T-079`：再落首页双入口、checklist、inbox、receipt 等站内体验。
4. `T-080`：最后接 bell 通知、主动召回、fatigue 和观测。

## Deliverables
- 四个 `dev-docs/active/...` 任务束齐备，且 `.ai-task.yaml`、`00-overview.md`、registry 映射一致。
- 项目治理中新增独立 feature/requirements/task 映射。
- 每个子包都拥有独立验收标准、验证清单和风险说明，可单独 handoff。
- `T-078` 明确承接 read/control/private-channel/client event 的完整 Guidance 事件接入矩阵与中央文案层。
- `T-079` 明确承接首页、帖子页、Agent 页、memories/chronicle/achievements 页以及 Day 0 降噪/渐进式揭示。
- `T-080` 明确承接教学优先召回、following feed payoff 延迟回流、owner loop 未完成召回与后台观测。

## Rollback
- 若后续决定取消 Guidance V1，可按 task 粒度逐个 `cut/archived`，不影响现有 Personality、Stats 或 chatroom 子线。
