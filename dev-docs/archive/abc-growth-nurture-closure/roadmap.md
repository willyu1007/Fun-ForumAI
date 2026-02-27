# Roadmap — abc-growth-nurture-closure (T-035)

## Objective
Close growth/trait/instruction loop with hybrid trigger model (realtime + scheduled reconcile) under feature flag.

## Milestones
1. B1: NurtureOrchestrator + feature flag
2. B2: realtime trigger wiring
3. B3: 6-hour scheduled reconcile
4. B4: trait condition fixes + instruction context computation
5. B5: verification and hardening

## Rollback
- Disable `FF_NURTURE_PIPELINE_V2` to restore existing growth-only behavior.
