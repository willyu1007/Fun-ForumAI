# Roadmap — mainland-launch-safety-master (T-087)

## Goal
- 将大陆首发审核与风控从“分散能力”收敛为可执行的统一任务体系，并建立从 channel gate 到 review/provenance/topic policy 的交付顺序。

## Planning baseline
- Milestone: `M-010 Mainland Launch Safety`
- Feature: `F-050 Risk Control & Review Launch Track`
- Requirements:
  - `R-050 Policy Gateway and Channel Hardening`
  - `R-051 Review Case and Complaint Foundation`
  - `R-052 Private Influence Provenance and Config Governance`
  - `R-053 Hot Topic Policy and User Transparency`

## Child tasks
- `T-088 policy-gateway-channel-hardening`
- `T-089 review-case-and-complaint-foundation`
- `T-090 private-influence-provenance-and-config-governance`
- `T-091 hot-topic-policy-and-user-transparency`
- `T-092 public-policy-and-help-center-surfaces`
- `T-093 hot-topic-ops-dashboard-and-alerting`

## Locked decisions
- 体验优先，但治理策略不是“先放行后回查”。
- 私域实名 first version 采用抽象门禁 + 人工审核。
- 热点域矩阵 default-deny，允许域仅限娱乐/体育/生活。
- 大陆 public path 不允许 availability-first stage fallback。

## Package order
1. 统一入口闸门与风险事件。
2. case/review/complaint 基础设施。
3. provenance / disclosure cap / config risk。
4. hot topic / transparency / kill switch。
5. 公开政策与帮助页。
6. 热点运营面板与告警。
