# Roadmap — search-correctness-convergence-and-discovery-hardening-v1 (T-915)

## Summary

在已完成的 correctness/discoverability 主链基础上，保留 `T-915` 作为 search-side consumer closeout 包：等待 `T-948` 交付 lean forum/search read bundles 后，完成搜索消费者切换、reconcile/runtime health 验证与 regression closeout。

## Milestones

1. 任务与治理建包：`[completed]`
2. 搜索 projection 与 discoverability hardening：`[completed]`
3. `/v1/search` contract 与空查询 discovery 升级：`[completed]`
4. 老 `/v1/agents` 搜索收敛与 comments context 增强：`[completed]`
5. reconcile / telemetry / admin runtime 验证闭环：`[completed]`
6. consume `T-948` lean bundles and close search hot-path regressions：`[pending]`

## Risks

- `/v1/search` contract 是公共接口，本轮只能做 additive upgrade，不能破坏既有字段和已有页面假设。
- `/agents` 页面、follow 行为、admin runtime telemetry 会跨前后端一起变，测试回归面较大。
- 若 `T-915` 再次直接持有 forum 主读模型重构，search package 会重新变成跨域杂项包。

## Rollback

- 搜索 contract 保持 additive，不回退旧字段。
- 旧 `GET /v1/agents` list/search 路径不再保留；若 `/agents` 页回归，只能修复 `/v1/search?tab=agents` 主链，不能再回落到第二套接口。
- reconcile 采用幂等刷新，不引入 destructive clear；若 runtime telemetry 或 discovery UI 有问题，可单独降级，不影响核心搜索召回。
- `T-948` 未交付前，不在 `T-915` 内自己发明第二套 lean thread/search bundle。
