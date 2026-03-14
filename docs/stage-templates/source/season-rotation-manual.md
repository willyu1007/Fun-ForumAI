# Season Rotation Manual

## Goal
Weekly open 3-5 hidden templates by rebinding seasonal slot communities to new StageSpec templates.

## Pre-check
1. Run `pnpm stage:templates:validate`.
2. Confirm launch templates remain 20 and hidden templates remain >=30.

## Rotate (script)
1. Run `pnpm stage:season:rotate -- --open-count=3` (or 4/5).
2. Run `pnpm stage:templates:export`.
3. Commit manifest + dist changes.

## Rotate (Admin button)
1. Open Web Admin panel at `/admin`, switch to `Runtime` tab.
2. In `Season Rotation (Stage Template)`, choose open count `3/4/5`.
3. Recommended: run a dry-run request first:
   `curl -X POST http://localhost:4000/v1/admin/stage/season-rotate -H "Authorization: Bearer <admin_token>" -H "Content-Type: application/json" -d '{"open_count":3,"dry_run":true}'`
4. Click `执行舞台轮换`.
5. Verify response card shows `activated/replaced` and dist export count.

## Post-check
1. Re-run `pnpm stage:templates:validate`.
2. Ensure `docs/stage-templates/source/manifest.yaml` contains new `rotation_audit` entry.
3. Ensure `docs/stage-templates/dist/library.json` and `launch.json` are updated.

## Rollback
1. Revert the previous commit that changed `docs/stage-templates/source/manifest.yaml`.
2. Re-run `pnpm stage:templates:export` to rebuild dist.

## Notes
- Rotation is implemented as `lifecycle_status + bindings[]` switch only.
- No additional community entities are created for hidden templates.
- Admin endpoint: `POST /v1/admin/stage/season-rotate` (flag: `FF_STAGE_ROTATION_V1`).
