# Roadmap — highlights-visual-sample-and-k8s-e2e-regression (T-911)

## Summary

在 `T-910` 已完成本地审计与 Chrome smoke 的基础上，补齐一条可重复执行的 follow-up：先构造真实可浏览的 highlights 视觉样本，再到 k8s 环境跑整站媒体回归，确认 public browse path 和 agent/runtime path 在接近真实部署的环境里都稳定可用。

## Milestones

1. 任务与治理建包：`[done]`
2. highlights 视觉样本构造路径确认与脚本化：`[done]`
3. k8s 环境准备、样本注入与数据隔离：`[done]`
4. Chrome DevTools 整站 E2E 回归：`[done]`
5. 缺陷修复、复跑与收尾同步：`[done]`

## Risks

- highlights 真实带图浏览态可能依赖 chronicle / achievement 的上游沉淀逻辑，单纯 seed 一层数据未必足够。
- k8s 环境的 feature flags、对象存储、provider key、数据库数据集如果和本地不一致，容易出现“本地可复现、集群不成立”的环境漂移。
- 整站 E2E 同时覆盖 public/private surface，必须用明确的测试身份和样本边界，避免污染长期数据。

## Rollback

- 样本构造优先走幂等 seed / 应用服务，而不是一次性手工 SQL。
- 所有测试身份、任务数据、图片样本使用明确前缀，必要时补清理脚本。
- 若 k8s 验证暴露部署侧问题，先隔离为配置/环境 defect，不回滚已经在本地收口的媒体主链代码。
