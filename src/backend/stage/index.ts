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

export {
  ACTOR_SURFACES,
  DIRECTOR_SURFACES,
  PRIVATE_SURFACES,
  actorSurfaceSchema,
  buildSceneBindingV1FromManifestItem,
  buildScenePoolCatalogFromManifest,
  directorSurfaceSchema,
  episodeBriefSchema,
  episodeOverlayV1Schema,
  localIntentSchema,
  parseLegacyStageTemplateDocument,
  privateChatContextSchema,
  privateSurfaceSchema,
  projectLegacyLifecycleStatus,
  projectLegacyTemplateToStageTemplateV2,
  proactiveDmOpeningContextSchema,
  runtimeSceneStateV1Schema,
  sceneBindingV1Schema,
  sceneMetadataSchema,
  stageTemplateDirectorSchema,
  stageTemplateV2Schema,
} from './public-director-contract.js'
export type {
  ActorSurface,
  DirectorSurface,
  EpisodeBrief,
  EpisodeOverlayV1,
  LocalIntent,
  LocalIntentTargetRef,
  PrivateChatContext,
  PrivateSurface,
  ProactiveDmOpeningContext,
  RuntimeSceneStateV1,
  SceneBindingV1,
  SceneMetadata,
  ScenePoolCatalog,
  ScenePoolCatalogEntry,
  StageTemplateDirector,
  StageTemplateV2,
} from './public-director-contract.js'
