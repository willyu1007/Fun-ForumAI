<!-- INIT:START-HERE:LLM-TEMPLATE -->
<!--
LLM rules:
- Render this file in the user-confirmed language stored at: init/_work/.init-state.json -> llm.language
- Keep the top section one-screen readable (aim <= ~60 lines).
- Do not include explicit SSOT mapping tables.
- Keep status values as literals: todo | confirmed | tbd (do not translate).
- On stage start (A->B, B->C, C->complete): roll up the finished stage into Archive and reset the top focus.
-->

# START-HERE（项目初始化入口）

> 用户可读的初始化笔记。阶段命令与状态请看 `init/INIT-BOARD.md`。

## Current focus
- 初始化主流程已完成（A/B/C 全部批准）。
- 当前重点：post-init 选择（是否更新 root 文档、是否清理 `init/` 引导包）。

## Current conclusions
- 产品核心是“仅 Agent 可写 Data Plane，人类仅可读与管理 Control Plane”。
- 主体验证路径包含三类用户旅程：旁观者看戏、Owner 养成、管理员治理。
- 技术架构采用事件驱动，Agent Runtime 经工具调用写入，并有审核、预算和审计回放闭环。
- MVP 路线已确定为三阶段：A 论坛+内置 agent，B 引入 Owner 与 agent 允许行为，C 接入聊天室。
- 审核策略确定为低风险直发、高风险审核、按社区差异阈值判定。
- 阶段 B 的 agent 允许行为已收敛为“逛论坛读动作”，不新增互动写入需求。
- 合规策略为首发不做地区化差异；日志与审计留存建议已记录到 Stage A 文档。
- Highest risk 的事件风暴已补充为服务端事件响应分配器方案，并给出首版配额与降级阈值。
- Stage B 蓝图已启用全部 features（含 iac），并通过 `validate` 校验。
- `skills.packs` 已按“全量 pack”启用：workflows、standards、testing、context-core、backend、frontend。
- Stage C `apply` 已完成；skill retention 已确认（无删除项）；术语已迁移到 `docs/context/glossary.json`。

## Key inputs (keep small)

| Key | Value | Status |
|---|---|---|
| Project name | LLM Only Forum / Chat（仅 LLM 参与的论坛与聊天室） | confirmed |
| One-line purpose | 构建一个仅由 LLM Agent 在公共区互动、人类只旁观与管理的论坛/聊天室系统 | confirmed |
| Primary users | Observer、Owner、Admin；Agent 与 Showrunner 为系统执行角色 | confirmed |
| Must-have scope | Data Plane 写入隔离、工具调用写入链路、审核分级、预算限流、可审计回放 | confirmed |
| Out-of-scope | 人类公开发言、人类实时遥控 agent、MVP 阶段复杂关系图与跨平台扩展 | confirmed |
| Constraints | 非实时配置生效、低带宽控制输入、服务间鉴权、成本与风控优先 | confirmed |
| Success metrics | 旁观者 30 秒可见主线内容；权限绕过测试全阻断；预算与审核策略生效 | confirmed |
| Tech stack preference | TypeScript + pnpm；Web=React，Mobile=React Native+Expo，Backend=Express，DB=Postgres+Prisma，Stage C 实时层=WebSocket | confirmed |
| Timeline / deadline | 已确认 A/B/C 三阶段推进；具体日程在 Stage B blueprint 固化 | confirmed |

## AI questions (next to ask)
- [ ] 是否现在执行 `update-root-docs --apply` 更新根目录 `README.md` 与 `AGENTS.md`。
- [ ] 是否现在执行 `cleanup-init --apply --i-understand --archive` 清理并归档 `init/`。

## This round notes
- 已读取 PRD 与 DevSpec，并将关键术语、需求、NFR、风险问题写入 Stage A 文档。
- Stage A 已批准，当前阶段已切换到 Stage B（Blueprint）。
- Stage B 蓝图已启用全部 features 并通过 `validate`。
- Stage B 已批准，当前阶段已切换到 Stage C（Scaffold）。
- Stage C 已执行 `apply --providers both`，已生成脚手架与 feature 配置，并同步 wrappers。
- skill retention 已确认（当前删除清单为空）。
- Stage C 已批准，初始化状态为 complete；术语迁移已执行并刷新 context checksum。

---

<details>
<summary>Archive (append-only; folded by default)</summary>

<!--
LLM: Append one short block per stage boundary with a clear separator.

Format suggestion:
----
### Stage <A|B|C> wrap-up - <YYYY-MM-DD>
- Summary:
- Decisions landed:
- Key input changes:
- Open questions:
-->

----
### Stage A wrap-up - 2026-02-20
- Summary: Stage A 四份文档已完成并通过严格校验，阶段已批准并切换到 Stage B。
- Decisions landed: MVP 三阶段路线、审核策略、反作弊策略、合规基线、日志审计留存、事件响应分配机制。
- Key input changes: 阶段 B 明确仅开放 agent 逛论坛读动作，不新增互动写入需求。
- Open questions: Stage B 需确定 Provider 主备策略、成本上限与特性开关组合。

----
### Stage B wrap-up - 2026-02-20
- Summary: Stage B 蓝图完成，已开启全部 features 与全部 skills packs，并通过校验后批准进入 Stage C。
- Decisions landed: `db.ssot=repo-prisma`，`ci.provider=github`，`iac.tool=terraform`，全量 packs 启用。
- Key input changes: 从需求讨论转入 Stage C 执行与产物审阅。
- Open questions: Stage C 评审后是否立即执行 root docs 更新。

----
### Stage C wrap-up - 2026-02-20
- Summary: Stage C 已执行并完成审批，脚手架、features、wrappers、skill retention 均已完成。
- Decisions landed: 全 features 物化，skill retention 无删除项，context glossary 完成迁移。
- Key input changes: 初始化进入 post-init 收尾决策阶段。
- Open questions: 是否立即执行 root docs 更新与 init 清理归档。

</details>
