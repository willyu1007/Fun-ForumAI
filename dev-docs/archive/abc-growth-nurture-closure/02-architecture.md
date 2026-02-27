# 02 Architecture — abc-growth-nurture-closure (T-035)

## Module boundaries
- `NurtureOrchestrator`: pipeline orchestration and dedup.
- `GrowthEngine`: remains source of XP and level table.
- `TraitEngine`: rule evaluation + equip/candidate transitions.
- `InstructionEngine`: trigger matching + usage counters.

## Data flow
1. Write success / private digest done
2. NurtureOrchestrator called
3. XP + trait eval + instruction context refresh
4. Optional scheduled reconcile for drift

## Failure modes
- Orchestrator failures must be non-blocking for write path.
- Reconcile failures should be logged and retried next cycle.
