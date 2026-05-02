// Stable fallback types for optional kickoff-local tooling.
// The actual local authoring stack may provide richer shapes, but the shared
// app surface should not depend on `.ai/.tmp/**` existing in every checkout.

export type KickoffAdmissionState = 'blocked' | 'ready'
export type KickoffDataMode = 'disabled' | 'kickoff-local' | 'snapshot'
export type KickoffEditorialReviewResult = Record<string, unknown>
export type KickoffExecExportStatus = 'idle' | 'running' | 'success' | 'failed'
export type KickoffExecLogicalEntityMapEntry = Record<string, unknown>
export type KickoffExecMissingExportField = Record<string, unknown>
export type KickoffExecReviewStatus = 'idle' | 'pending' | 'passed' | 'failed'
export type KickoffFlowPhase = 'idle' | 'planning' | 'review' | 'execution' | 'complete'
export type KickoffFlowStatus = 'idle' | 'running' | 'blocked' | 'done'
export type KickoffFlowStepKey = string
export type KickoffFlowStepState = 'idle' | 'running' | 'blocked' | 'done'
export type KickoffFreezeManifest = Record<string, unknown>
export type KickoffImportHistoryRecord = Record<string, unknown>
export type KickoffImportReport = Record<string, unknown>
export type KickoffImportRunType = string
export type KickoffImportSummary = Record<string, unknown>
export type KickoffLayerReadiness = Record<string, unknown>
export type KickoffProfileId = string

export interface KickoffRuntimeReadiness {
  ok?: boolean
  reasons?: string[]
  [key: string]: unknown
}

export interface KickoffRunArtifacts {
  [key: string]: unknown
}

export interface KickoffRunSummary {
  id: string
  status?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface KickoffRunDetail extends KickoffRunSummary {
  artifacts?: KickoffRunArtifacts | null
}

export type KickoffSeedActorSourcePolicy = Record<string, unknown>
export type KickoffSeedBrief = Record<string, unknown>
export type KickoffSeedCommunityAllocation = Record<string, unknown>
export type KickoffSeedCommunityConstraints = Record<string, unknown>
export type KickoffSeedContractRefs = Record<string, unknown>
export type KickoffSeedEntityPlan = Record<string, unknown>
export type KickoffSeedMeta = Record<string, unknown>
export type KickoffSeedRoleHints = Record<string, unknown>
export type KickoffSeedSlotBrief = Record<string, unknown>
export type KickoffSeedWavePlanDefaults = Record<string, unknown>

export interface KickoffSeedDocument {
  id?: string
  title?: string
  [key: string]: unknown
}

export interface KickoffSeedPayload {
  seed?: KickoffSeedDocument | null
  [key: string]: unknown
}

export interface KickoffStatusPayload {
  data_mode?: KickoffDataMode
  flow_phase?: KickoffFlowPhase
  flow_status?: KickoffFlowStatus
  runtime_readiness?: KickoffRuntimeReadiness | null
  latest_run?: KickoffRunSummary | null
  [key: string]: unknown
}
