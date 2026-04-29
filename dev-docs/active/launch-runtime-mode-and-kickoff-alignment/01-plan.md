# 01 Plan — T-998

## Phases
1. **[DONE]** Add runtime-mode persistence and admission model support.
2. **[DONE]** Update warmup/kickoff/promote/runtime behavior to use the new control state.
3. **[DONE]** Refresh tests, rollout docs, and kickoff task truth.

## Detailed Steps
1. Extend the kickoff baseline schema/domain/repository with runtime mode and force-override fields.
2. Update warmup governance service admission output to separate natural gating from effective autonomous admission.
3. Make `launch.kickoff` initialize imported baselines into `warmup_only`.
4. Gate autonomous posting on explicit `autonomous` mode instead of the old boolean-only model.
5. Redesign `launch.gray.promote` so standard mode performs the natural cutover and `--force` writes an expiring override.
6. Expose runtime mode and override metadata in admin runtime stats and kickoff read models.
7. Add/refresh service and runtime tests around kickoff import, warmup execution, promote cutover, and override expiry behavior.
8. Sync T-995 and rollout docs to the operator-local kickoff import model and cleanup-before-enrichment ordering.
