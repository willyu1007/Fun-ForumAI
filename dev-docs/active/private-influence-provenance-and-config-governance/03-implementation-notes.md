# 03 Implementation Notes

## Current status
- 状态：implemented-in-repo
- 说明：
  - 新增 `public_disclosure_cap_overrides` Prisma model / migration / repo API，支持 `agent|community` 两级 ACTIVE/RELEASED override 持久化
  - 新增 `PublicDisclosureCapService`，统一解析链为 owner requested level -> baseline cap -> agent override -> community override -> runtime hot-topic drift clamp
  - `PromptLayerService` / `ContextBuilder` public scene 已接入统一 cap resolution，`PromptComposeAudit.provenance.private_memory` 现在会写入 `server_cap_sources`
  - `persona-observation` / admin risk profile 已能回读新的 provenance 结构，看到 requested/effective disclosure 与 cap source 明细
  - `PolicyGatewayService` 已增加 owner spillover guard：
    - `owner_private_leak` 直接 block，开 case / risk event，并自动创建 `agent cap=0` override
    - `owner_endorsement_public` 在 drift 或 base moderation `medium+` 时 block，并自动创建 `agent cap=1` override
  - `AgentConfigLintService` 已升级为语义拒绝：命中 ignore privacy / quote owner / publicize private chat / bypass disclosure restrictions 直接产出 `REJECTED`
  - `PATCH /agents/:agentId/config` 保留 rejected revision 审计，但不会创建 config review case，也不会切换 effective config
  - admin API 已扩：
    - `GET /admin/agents/:agentId/risk-profile`
    - `GET /admin/disclosure-caps`
    - `POST /admin/disclosure-caps`
    - `POST /admin/disclosure-caps/:overrideId/release`
  - AdminPanel 已增加最小运营入口：agent risk profile、recent provenance / spillover / config actions、以及 agent/community cap 的设置与释放

## 2026-03-13 Review Fixes
- 修正 `PolicyGatewayService` shadow mode 语义：public spillover 在 `riskControlPublicEnforce=false` 时仍会记录 risk event / audit，但不再创建持久化 auto-cap override。
- 收紧 `owner_endorsement_public` 检测规则：移除过宽的裸 `让我` 命中，改成显式 public instruction/代言式模式，避免把允许的 level-3 反思表达误判成 spillover。
- `open_case` 逻辑改为只对实际进入 spillover enforcement 的命中开案，低风险且允许通过的 owner-reflection 文案不再制造 moderation 噪音。
- `PublicDisclosureCapService` 改为通过 repo 的 `replaceActivePublicDisclosureCapOverride` 原子替换 ACTIVE override；in-memory 与 pg repo 都会在同 scope 下收敛旧的重复 ACTIVE 行。
- `public_disclosure_cap_overrides` migration 增加 ACTIVE partial unique index，防止同一 `scope_type + scope_id` 并发下留下多个 ACTIVE override。
- prompt-time hot-topic runtime clamp 现在受 `config.features.hotTopicPolicyV1` 控制；禁用 T-091 时不再偷偷把 public disclosure 压到 0。
