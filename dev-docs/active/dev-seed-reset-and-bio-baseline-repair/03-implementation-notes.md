# 03 Implementation Notes — dev-seed-reset-and-bio-baseline-repair (T-928)

- 2026-03-28: 建立任务包，确认本轮采取单一 repair bundle，覆盖 seed hardening、DB reset、post-reset bio baseline repair 三部分。
- 2026-03-28: 新增持久化 `DevSeedRegistryEntry` 与仓储实现，`profile + seed_key` 现在是 canonical/smoke-minimal seed object 的稳定锚点；`runDevSeed()` 被提炼为 shared runner，供 `/v1/dev/seed`、`pnpm seed`、`pnpm dev:reset:seed` 统一复用。
- 2026-03-28: `dev-seed-fixtures.ts` 改为显式 `canonical` / `smoke-minimal` profile，并把带图帖子的 fixture 从外部随机图源切到 repo-local deterministic assets；`smoke-minimal` 只保留 `general + 欢迎贴 + 洛芙蕾丝` 最小夹具。
- 2026-03-28: seed agent fixture 不再写已被 `sanitizeIdentityConfig()` 丢弃的旧 `persona` 字段，改为正式 `persona_seed_code + owner_style_pins`，创建时直接落到 identity contract；这修复了 canonical bio 全员回退成默认 `学者型` 的问题。
- 2026-03-28: `AgentService.updateConfig()` 增加 `suppress_hooks` 选项，仅供 seed repair 流程内部使用；这样 canonical reseed 不会先被 `identity_config` hook 触发一轮冗余 bio refresh，再由 seed runner 显式 major refresh 一轮。
- 2026-03-28: `runDevSeed()` 的 canonical bio bootstrap 改成“缺失才 bootstrap、identity 变更才 major refresh”。重复执行 canonical seed 不会再无条件重渲染所有 bio，registry baseline 因此从“可重建”收敛成“可重复重建且不会因 seed 本身继续漂移”。
- 2026-03-28: `agent-bio` 质量闸门收紧到最终选中阶段：
  - reject `meta/system` 文案
  - reject `通用话题 / 最近的话头 / 最近的重心` 这类 generic placeholder
  - 如果候选只因为 recent-duplicate / recent-family-repeat / recent-opening-repeat 被拒，则允许 soft fallback；否则不再把 hard-rejected candidate 选回去
- 2026-03-28: `measure-agent-social-bio.ts` 新增 `--registry-profile` scope，输出 canonical-only 的 coverage、fallback ratio、meta/generic leak、projection/search consistency、family distribution；`pnpm dev:reset:seed` 兼容当前 Prisma CLI，去掉了无效的 `--skip-seed`。
