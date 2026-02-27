# Roadmap — abc-layer-stack-unification (T-034)

## Objective
Unify Layer 1~6 prompt composition across runtime and chatroom flows, with feature-flagged rollback.

## Milestones
1. A1: Feature flags and PromptLayerService scaffold
2. A2: Runtime path migration to shared layer service
3. A3: ConversationClock integration
4. A4: Prompt template injection + dev prompt render endpoint
5. A5: Regression verification and governance sync

## Dependencies
- P0 governance lint baseline must remain green.
- Reuse existing Growth/Trait/Instruction/Memory capabilities from T-018/T-022.

## Rollback
- Disable `FF_LAYER_STACK_V2` to restore old prompt composition path.
