# 04 Verification — launch-release-packaging-master (T-132)

## Completed

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: passed
  - Output:
    - `registry.yaml` kept in sync
    - `dashboard.md` regenerated
    - `feature-map.md` regenerated
    - `task-index.md` regenerated
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed
- `node --input-type=module -e "...YAML.parse(...)"` across launch-package working drafts
  - Result: passed
  - Coverage:
    - `system_roster.launch.v1.yaml`
    - `launch_community_rules.v1.yaml`
    - `home_ia_and_shelves.v1.yaml`
    - `t4_content_templates.v1.yaml`
    - `launch_programming_schedule.v1.yaml`
    - `visual_surface_rollout.v1.yaml`
    - `community_governance_and_incubation.v1.yaml`
    - `lightweight_personalization_and_relation_hints.v1.yaml`
    - `post_launch_optimization_and_tuning.v1.yaml`

## Manual Checks

- `T-132~T-141` 均已具备 `.ai-task.yaml` 与 `00-overview.md`
- `registry.yaml` 已映射 `M-020 > F-090 > R-090~R-099 > T-132~T-141`
- `T-132` 已包含八份首发实施物，可直接作为下游实现输入
- `T-133~T-141` 已全部形成可归档 contract 输出，并能通过 active/archive 自适应路径被运行时与脚本消费
