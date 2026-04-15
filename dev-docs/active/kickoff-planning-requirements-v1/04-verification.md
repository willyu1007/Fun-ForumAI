# 04 Verification — kickoff-planning-requirements-v1 (T-968)

## 2026-04-15 — planning artifact paths

```bash
find dev-docs/active/kickoff-planning-requirements-v1 -maxdepth 1 -type f | sort
sed -n '1,240p' docs/project/overview/kickoff-planning-requirements.md
sed -n '1,260p' docs/project/overview/kickoff-planning-review-checklist.md
sed -n '1,320p' docs/project/overview/kickoff-orchestration-blueprint.md
sed -n '1,240p' config/kickoff/planning/requirements.v1.yaml
sed -n '1,320p' config/kickoff/planning/orchestration-stage-blueprint.template.v1.yaml
```

- Result: passed
- Evidence:
  - task bundle files exist under `dev-docs/active/kickoff-planning-requirements-v1/`
  - human-readable requirement doc exists under `docs/project/overview/`
  - human-readable review checklist exists under `docs/project/overview/`
  - human-readable orchestration blueprint exists under `docs/project/overview/`
  - machine-readable planning draft exists under `config/kickoff/planning/`
  - machine-readable stage blueprint template exists under `config/kickoff/planning/`

## 2026-04-15 — formatting check

```bash
pnpm exec prettier --write dev-docs/active/kickoff-planning-requirements-v1/.ai-task.yaml
pnpm exec prettier --check docs/project/overview/kickoff-planning-requirements.md docs/project/overview/kickoff-planning-review-checklist.md docs/project/overview/kickoff-orchestration-blueprint.md config/kickoff/planning/requirements.v1.yaml config/kickoff/planning/orchestration-stage-blueprint.template.v1.yaml dev-docs/active/kickoff-planning-requirements-v1/00-overview.md dev-docs/active/kickoff-planning-requirements-v1/01-plan.md dev-docs/active/kickoff-planning-requirements-v1/02-architecture.md dev-docs/active/kickoff-planning-requirements-v1/03-implementation-notes.md dev-docs/active/kickoff-planning-requirements-v1/04-verification.md dev-docs/active/kickoff-planning-requirements-v1/05-pitfalls.md dev-docs/active/kickoff-planning-requirements-v1/roadmap.md dev-docs/active/kickoff-planning-requirements-v1/.ai-task.yaml
```

- Result: passed
- Note: only `.ai-task.yaml` needed auto-formatting; final check returned `All matched files use Prettier code style!`

## 2026-04-15 — governance sync

```bash
node .ai/scripts/ctl-project-governance.mjs sync --apply --project main
```

- Result: passed
- Evidence:
  - `.ai/project/main/registry.yaml` updated
  - `.ai/project/main/dashboard.md` regenerated
  - `.ai/project/main/task-index.md` regenerated
  - `T-968` registered in the project hub

## 2026-04-15 — stage blueprint template parse check

```bash
node --input-type=module -e "import fs from 'node:fs'; import YAML from 'yaml'; const p='config/kickoff/planning/orchestration-stage-blueprint.template.v1.yaml'; const doc=YAML.parse(fs.readFileSync(p,'utf8')); console.log(doc.template_id, Array.isArray(doc.stage_templates), doc.stage_templates.length);"
```

- Result: passed
- Output summary:
  - `template_id = kickoff-orchestration-stage-blueprint`
  - `stage_templates` parsed successfully
  - current template contains `12` stage templates

## 2026-04-15 — governance lint

```bash
node .ai/scripts/ctl-project-governance.mjs lint --check --project main
```

- Result: failed, but not because of `T-968`
- Resolved in this pass:
  - `T-964` status drift fixed by changing invalid `completed` to valid `done`
- Remaining blockers:
  - existing `T-201` duplicate task id across `dev-docs/active/llm-matrix-refresh-and-media-fallback-v1` and `dev-docs/active/t-201-following-feed-revamp`
  - existing `T-201` registry path/status mismatch
  - existing missing archive paths for `T-965/T-966/T-967`

## 2026-04-15 — governance lint recheck after blueprint landing

```bash
node .ai/scripts/ctl-project-governance.mjs lint --check --project main
```

- Result: failed, unchanged from earlier run
- Conclusion:
  - `T-968` blueprint/checklist changes did not introduce new governance lint failures
  - remaining blockers are still the pre-existing `T-201` duplicate/path drift plus missing archive paths for `T-965/T-966/T-967`

## 2026-04-15 — governance sync and lint recheck after template landing

```bash
node .ai/scripts/ctl-project-governance.mjs sync --apply --project main
node .ai/scripts/ctl-project-governance.mjs lint --check --project main
```

- Result:
  - `sync --apply`: passed
  - `lint --check`: failed, unchanged
- Conclusion:
  - machine-readable template landing did not introduce new governance lint failures
  - remaining blockers are still the pre-existing `T-201` duplicate/path drift plus missing archive paths for `T-965/T-966/T-967`

## 2026-04-15 — current kickoff image strategy diagnosis

```bash
ls -lah public/kickoff-boards
rg -n "visual_asset_path:" src/backend/launch/launch-warm-start.ts
python - <<'PY'
from collections import Counter
import pathlib,re
p=pathlib.Path('src/backend/launch/launch-warm-start.ts').read_text()
paths=re.findall(r"visual_asset_path: '([^']+)'", p)
print('asset_paths', len(paths))
for k,v in Counter(paths).items():
    print(v, k)
PY
```

- Result: passed
- Findings:
  - 当前 kickoff 使用的是 `public/kickoff-boards/` 下的少量预置 `webp` 板图
  - `launch-warm-start.ts` 中共有 `7` 处 `visual_asset_path`
  - 实际只复用了 `5` 张唯一图片，其中两张被重复挂载：
    - `incident-freeze-frame.webp` 使用 `2` 次
    - `debate-split-screen.webp` 使用 `2` 次
- Conclusion:
  - 当前图片质量问题不只是“审美观感一般”，还包括“图帖绑定粒度过粗、少量资产重复挂载”的结构性问题
