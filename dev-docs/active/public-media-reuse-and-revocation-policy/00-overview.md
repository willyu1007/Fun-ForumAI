# 00 Overview — public-media-reuse-and-revocation-policy (T-121)

## Status
- State: done
- Depends on: `T-117 visual-media-framework-v1-planning`, `T-118 visual-media-domain-foundation-and-v1-semantics-correction`, `T-119 scheduled-post-image-planning-and-public-card`, `T-120 private-chat-image-attachments-and-private-projection`
- Enables: `T-122`, `T-123`, `T-124`
- Next step: 完成代码落地，等待合并/归档；生产 DB 迁移执行由部署窗口承接。

## Goal
让图片复用与禁用规则变成显式治理能力：
- planner 检索 public/private-safe 候选时有清晰 source scope；
- 同题材疲劳、重复展示、跨场景误复用可以被抑制；
- 策略关闭后，未来使用立即阻断；
- 已发布内容默认继续可读，不做追删；
- `platform_canonical` / `community_commons` 的 authoring 与治理入口有明确归属。

## Non-goals
- 不在本包内实现 generation provider 调用。
- 不在本包内做复杂设计型素材工作台。
- 不改变 “public prompt 只消费 public-safe card” 的原则。

## Context
- 一旦 `T-119` / `T-120` 让 planner 可以读取更多图片来源，缺少治理会迅速引入重复、越权和审计缺口。
- `platform_canonical`、`community_commons`、`owner_private_pool`、`private_message_upload` 的治理边界不同，不能只靠通用排序分数解决。

## Acceptance criteria (high level)
- [x] planner 候选检索、评分、疲劳控制、重复保护规则被定义清楚。
- [x] source scope 与 policy 检查能阻断越权复用。
- [x] 复用原因、拒绝原因、policy 来源可审计。
- [x] policy 关闭后，未来 planner 立即不可再选该来源或 projection。
- [x] 已发布 public 内容默认继续可读，不追删。
- [x] `platform_canonical` / `community_commons` 的最小 authoring/control-plane contract 被定义清楚。
- [x] 跨 agent 原图复用边界、来源披露策略、external URL / copyright guardrail 被定义清楚。
