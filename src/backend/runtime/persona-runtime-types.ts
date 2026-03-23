import type { RenderTier } from '../../shared/agent-persona-catalog.js'
import type { PersonaVector, PersonaAxis } from '../../shared/persona-vector.js'
import type { OwnerStylePins } from '../identity/agent-identity.js'

export type PersonaRuntimeScene =
  | 'forum_post'
  | 'forum_thread'
  | 'forum_turn'
  | 'chat_room'
  | 'private_chat'
  | 'proactive_dm'
  | 'scheduled_post'

export type PersonaMaturity = 'seed' | 'forming' | 'stable' | 'arc_shift'

export type OverlayCode =
  | 'playful'
  | 'slightly_irritable'
  | 'guarded'
  | 'unusually_open'
  | 'withdrawn'
  | 'overconfident'
  | 'oversharing_risk'
  | 'destabilized'

export type OverlayCauseType =
  | 'owner_dm'
  | 'public_conflict'
  | 'ignored'
  | 'praise'
  | 'achievement'
  | 'canon_event'
  | 'scene_pressure'
  | 'novelty'

export type OverlayWritebackRule = 'none' | 'recurrence_only'

export type PromptAtomKind = 'tone' | 'pacing' | 'social' | 'restraint'

export interface PromptAtom {
  id: string
  text: string
  weight: number
}

export interface OverlayTemplate {
  code: OverlayCode
  sceneAllow: PersonaRuntimeScene[]
  delta: Partial<PersonaVector>
  intensityRange: [number, number]
  defaultTtlTurns: number
  maxTtlMinutes: number
  cooldownMinutes: number
  minRenderTier?: RenderTier
  critical: boolean
  writebackRule: OverlayWritebackRule
  promptAtoms: Record<PromptAtomKind, PromptAtom[]>
}

export interface ActiveOverlay {
  code: OverlayCode
  intensity: number
  enteredAt: string
  expiresAt: string
  remainingTurns: number
  cooldownUntil: string
  cause: {
    type: OverlayCauseType
    refId?: string
  }
  sampledAtoms: {
    toneAtomId: string
    pacingAtomId: string
    socialAtomId: string
    restraintAtomId: string
  }
  rngSeed: string
  critical: boolean
  delta: Partial<PersonaVector>
}

export interface RenderTierDecisionInputs {
  scene: PersonaRuntimeScene
  maturity: PersonaMaturity
  overlay: ActiveOverlay | null
  qualityGuard?: {
    recentDriftScore?: number
    recentFailures?: number
  }
}

export interface RenderTierDecisionResult {
  scene: PersonaRuntimeScene
  requestedTier: RenderTier
  reasons: string[]
  overlayCode?: OverlayCode
}

export interface PersonaState {
  current: PersonaVector
  anchor: PersonaVector
  maturity: PersonaMaturity
  confidence: number
  driftScore: number
  updatedAt: string
  version: number
  lastRenderDecision?: RenderTierDecisionResult | null
}

export interface PersonaProjection {
  coreSummary: string
  dominantAxes: Array<{ axis: PersonaAxis; value: number }>
  projectedPins: OwnerStylePins
  visibleStyle: string
}

export interface PersonaRuntimeEnvelope {
  state: PersonaState
  projection: PersonaProjection
  overlay: ActiveOverlay | null
  overlayShortTermState: string
  overlaySceneRule: string
  renderTierDecision: RenderTierDecisionResult
  cacheSalt: string
}

export interface PersonaRenderCueInput {
  agentId: string
  scene: PersonaRuntimeScene
  conversationText: string
  topicHints?: string[]
  externalSceneRule?: string
  externalShortTermState?: string
  externalRefId?: string
}

export interface PersonaDeltaInput {
  sourceType:
    | 'owner_style_pin'
    | 'trait_mutation'
    | 'instruction_mutation'
    | 'private_digest'
    | 'public_behavior_candidate'
    | 'stats_candidate'
    | 'overlay_recurrence_candidate'
  sourceRef?: string | null
  scene?: PersonaRuntimeScene | null
  salience: number
  rawDelta: Partial<PersonaVector>
  writebackApplied: boolean
  reason: string
}

export const OVERLAY_DEFAULT_TTL_TURNS = 4
export const OVERLAY_MAX_TTL_MINUTES = 45
export const SAME_OVERLAY_COOLDOWN_MINUTES = 20
export const NORMAL_OVERLAY_TRIGGER_CAP = 0.35
export const HIGH_VOLATILITY_TRIGGER_CAP = 0.6
export const NORMAL_WEEKLY_DRIFT_CAP = 6
export const ARC_SHIFT_WEEKLY_DRIFT_CAP = 16
export const NORMAL_EVENT_MAX_STEP = 2
export const ARC_EVENT_MAX_STEP = 6
export const SCENE_RULE_MAX_CHARS = 45

export const SHORT_TERM_STATE_MAX_CHARS_BY_SCENE: Record<PersonaRuntimeScene, number> = {
  chat_room: 60,
  forum_thread: 90,
  forum_turn: 90,
  forum_post: 90,
  private_chat: 120,
  proactive_dm: 120,
  scheduled_post: 90,
}
