# Roadmap — ui-preparation-foundation

## Milestones

| 阶段 | 目标 | 出口 |
|------|------|------|
| 阶段 0 | 冻结与审计 | 漂移清单、冻结规则、pilot 名单 |
| 阶段 1 | 真源与主题 | ui:build/check、data-theme、drift 可检 |
| 阶段 2 | 4 包与边界 | packages/*、import boundary lint |
| 阶段 3 | 模式组件与 AppShell | 10 个 pattern、AppShell、widgets、Web 消费 ui/styles |
| 阶段 4 | 试点迁移 | 列表/详情/表单 pilot、视觉回归 |
| 阶段 5 | 治理强化 | uix* 移除完成、chunk+budget、CI 门禁完整 |

## Scope

- **In**: ui/ 规范层、scripts/ui（Node ESM）、packages/*、src/frontend 消费与 Layout/AppShell 拆分、apps/mobile theme 消费、CI 中 UI 门禁。
- **Out**: 全站页面重写、apps/web 搬迁、新业务功能需求。

## Risks

- 现有 UI gate（Python）与新增 Node 脚本两套工具并存：明确分工（Python = 治理/contract 扫描；Node = token/theme/contract 生成与 drift）。
- uix* 全量迁移可能触及面大：先完成模式组件与 pilot，再按页面/模块分批迁移，最后移除 uix* 实现。

## Rollback

- 各阶段可独立验证；Phase 2 完成后可暂停，Web 仍从现有入口运行。
- 生成产物均可再生，回退时重新执行 ui:build 并恢复对旧入口的引用即可。
