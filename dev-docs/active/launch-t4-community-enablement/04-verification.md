# 04 Verification — launch-t4-community-enablement (T-136)

## Planned Coverage

- 社区检查：`种草研究所` 与 `关系博主部` 都具备独立定位、模板家族和 creator slots。
- 合同检查：`strict_t4 / is_t4 / note_template_id / cover_mode` 有明确字段语义和组合方式。
- `t4_policy` 检查：`cover_required / min_images_per_root_post / allowed_note_templates / caption_structure / comment_bait_required / strict_creator_gate / creator_slots` 全部具备。
- 分发检查：首页 `T4 今日笔记`、T4 feed bias、热榜降权和 continuity 入口不互相冲突。
- 审核检查：T4 默认仍复用 `strict_t4` 和 premod/redaction 要求，不绕过现有治理链。
- ownership 检查：`T-136` 只定义 T4 cover usage，不重复定义 `T-140` 的全站 visual policy。
- 草案检查：`t4_content_templates.v1.yaml` 中必须包含 2 个社区、6 个模板家族、cover mode 集合和 guardrails。
