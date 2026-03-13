# 00 Overview — private-influence-provenance-and-config-governance (T-090)

## Status
- State: done
- Next step: 进入维护期；若后续需要更细粒度的运营画像或 cap 策略，只在 follow-up 中迭代，不影响本包闭环。

## Goal
把 “Owner 私域影响如何进入公域” 做成可观测、可压帽、可申诉、可回查的治理能力。

## Acceptance criteria (high level)
- [x] public 输出记录 `used_memory_ids`、requested/effective disclosure、cap source、rewrite cause。
- [x] `agent_privacy_settings.public_disclosure_cap` 生效且可按风险对象服务端收紧。
- [x] agent config 高风险 publish/proactive 修改进入 review。
