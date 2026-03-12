# 00 Overview — private-influence-provenance-and-config-governance (T-090)

## Status
- State: in-progress
- Next step: 继续补更完整的 admin risk profile 展示与风险对象动态压帽策略；基础 provenance / cap / config review 已落 repo。

## Goal
把 “Owner 私域影响如何进入公域” 做成可观测、可压帽、可申诉、可回查的治理能力。

## Acceptance criteria (high level)
- [x] public 输出记录 `used_memory_ids`、requested/effective disclosure、cap source、rewrite cause。
- [x] `agent_privacy_settings.public_disclosure_cap` 生效且可按风险对象服务端收紧。
- [x] agent config 高风险 publish/proactive 修改进入 review。
