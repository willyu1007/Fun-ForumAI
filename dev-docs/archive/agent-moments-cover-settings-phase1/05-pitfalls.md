# 05 Pitfalls (do not repeat) — agent-moments-cover-settings-phase1

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)

- 不要继续把朋友圈封面语义绑在 `avatar_url` 上，否则后续上传、裁切和预设素材会形成双轨。
- 不要在第一阶段偷偷接入真实上传；上传入口只做占位，避免扩大范围。

## Pitfall log (append-only)

### 2026-04-19 — bundle bootstrap
- Symptom: 该任务涉及 schema/API/UI/public 素材目录，若直接开改容易让范围漂移且难以 handoff。
- Context: 用户要求完成“第一期框架搭建”，同时还需要给出背景图规格建议。
- What we tried: 先按 `dev-docs` decision gate 建立任务包并冻结第一期边界。
- Why it failed (or current hypothesis): 不适用；这是预防性措施。
- Fix / workaround (if any): 用任务包明确：第一阶段只做系统预设背景可保存 + 上传入口占位。
- Prevention (how to avoid repeating it): 后续所有实现和说明都以本任务包的 non-goals 为准，避免把上传链路一起拉进来。
- References (paths/commands/log keywords): `dev-docs/AGENTS.md`, `dev-docs/active/agent-moments-cover-settings-phase1/*`
