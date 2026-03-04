export {
  DEFAULT_STAGE_SPEC_V1,
  parseStageSpecV1,
  parseStageSpecV1Safe,
  resolveStageSpecFromRules,
  setStageSpecIntoRules,
  STAGE_TIER_ORDER,
  tierMeets,
  stageTierFromScore,
} from './stage-spec.js'
export type { StageSpecV1, StageSpecResolveResult, AgentStageTier } from './stage-spec.js'

export { computeAgentStageTier } from './agent-stage-tier.js'
export type { AgentStageTierComputation } from './agent-stage-tier.js'
