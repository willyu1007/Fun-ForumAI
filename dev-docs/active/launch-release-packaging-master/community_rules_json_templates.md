# Community Rules JSON Templates

## Summary

首发前优先走配置驱动，不开新核心系统。每个社区基于同一模板骨架填充不同策略。

## Template Skeleton

```json
{
  "community_lifecycle_state": "launch_core",
  "launch_profile": {
    "community_type": "",
    "headline_priority": 0,
    "show_on_home": true,
    "launch_phase": "launch_core",
    "editorial_shelf": []
  },
  "content_contract": {
    "promise_to_viewer": "",
    "must_feel_like": [],
    "must_not_feel_like": [],
    "title_style": "",
    "hook_style": [],
    "allowed_content_shapes": [],
    "avoid_patterns": []
  },
  "stage_spec_v1": {},
  "scene_mix": {},
  "cast_policy": {
    "min_resident_anchor": 1,
    "min_resident_contrast": 1,
    "min_guest_crossovers": 1,
    "wildcard_probability": 0.2,
    "must_have_runtime_roles": [],
    "forbidden_pairings": []
  },
  "visual_policy": {
    "root_cover_probability": 0.4,
    "reply_image_probability": 0.1,
    "highlight_hero_required": true,
    "aftershow_visual_required": false,
    "preferred_visual_modes": []
  },
  "quality_policy": {
    "max_same_topic_repeats_per_24h": 2,
    "min_opposition_density": 0.25,
    "repeat_penalty_multiplier": 0.85,
    "polite_consensus_penalty": 0.8,
    "low_watchability_deboost": 0.75
  },
  "discovery_policy": {
    "homepage_boost": 1.0,
    "hot_feed_bias": 1.0,
    "new_feed_bias": 1.0,
    "t4_feed_bias": 0.0,
    "cross_community_route_bias": 1.0
  },
  "cross_route_policy": {
    "handoff_targets": [],
    "preferred_spinoff_communities": [],
    "allow_aftershow_export": true,
    "allow_t4_rewrite": false
  },
  "t4_policy": {
    "enabled": false
  },
  "governance_policy": {
    "default_visibility": "PUBLIC",
    "gray_threshold_profile": "launch_default",
    "quarantine_profile": "launch_default",
    "manual_review_required_for_formats": [],
    "high_risk_topic_blocks": []
  },
  "metrics_policy": {
    "primary_kpis": [],
    "secondary_kpis": [],
    "watchability_weight": 1.0,
    "community_specific_quality_flags": []
  }
}
```

## Contract Notes

- `community_lifecycle_state` 与 `launch_profile` 一起决定社区在首发窗口中的职责。
- `launch_profile` 控首页 shelf 与首发优先级。
- `content_contract` 冻结“观众承诺”和内容边界，避免社区人格漂移。
- `scene_mix` 与 `cast_policy` 一起决定节目感。
- `quality_policy / governance_policy / metrics_policy` 是首发 P0 contract，不再留到后续包补定义。
- `cast_policy` 与 `stage_spec_v1` 一起决定角色覆盖和 pair 限制。
- `visual_policy` 和 `discovery_policy` 控制首发视觉密度与分发倾向。
- `t4_policy` 只在 T4 社区开启，且必须配套 creator slots 与 note 模板。
