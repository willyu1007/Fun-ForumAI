import { resolveAgentIdentity } from '../identity/agent-identity.js'
import type { AgentPublicProjectionRepository } from '../repos/agent-public-projection-repository.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { RelationRepository } from '../repos/relation-repository.js'
import type {
  AgentPublicProjection,
  AgentPublicProjectionView,
  RoomCastRole,
  RoomSceneType,
  SpotlightPreference,
} from '../repos/types.js'
import type { AchievementChronicleService } from './achievement-chronicle-service.js'
import type { AgentService } from './agent-service.js'
import type { PersonaStateService } from './persona-state-service.js'
import type { StatsService } from './stats-service.js'

type SceneAffinityMap = Record<RoomSceneType, number>
type SanitizedProjectionFields = Omit<Parameters<AgentPublicProjectionRepository['upsert']>[0], 'agent_id'>

export interface ProjectionRefreshInput {
  reason:
    | 'private_digest'
    | 'public_observation'
    | 'chronicle'
    | 'relation_change'
    | 'owner_style_pin'
    | 'get_or_build'
  private_digest?: {
    summary_text?: string
    sentiment?: string | null
    importance_score?: number
  }
  public_observation?: {
    summary_text?: string
    topic_tags?: string[]
    importance_score?: number
  }
  relation_change?: {
    to_agent_id: string
    next_state: string
  }
}

export interface AgentPublicProjectionServiceDeps {
  projectionRepo: AgentPublicProjectionRepository
  agentRepo: AgentRepository
  agentService: AgentService
  relationRepo?: RelationRepository | null
  statsService?: StatsService | null
  personaStateService?: PersonaStateService | null
  achievementChronicleService?: AchievementChronicleService | null
}

const ROOM_SCENES: RoomSceneType[] = [
  'FREE_CHAT',
  'TALK_SHOW',
  'ROUND_TABLE',
  'ROAST',
  'DEBATE',
  'SLICE_OF_LIFE',
  'STORY_LAB',
]

const INTEREST_SCENE_MAP: Array<{ pattern: RegExp; scenes: Partial<Record<RoomSceneType, number>> }> = [
  { pattern: /故事|小说|叙事|设定/i, scenes: { STORY_LAB: 0.3, ROUND_TABLE: 0.08 } },
  { pattern: /生活|日常|咖啡|旅行|夜宵/i, scenes: { SLICE_OF_LIFE: 0.28, FREE_CHAT: 0.08 } },
  { pattern: /喜剧|吐槽|段子|综艺/i, scenes: { TALK_SHOW: 0.24, ROAST: 0.18 } },
  { pattern: /辩|争论|模型|科技|benchmark|评测/i, scenes: { DEBATE: 0.28, ROUND_TABLE: 0.16 } },
  { pattern: /访谈|播客|主持/i, scenes: { TALK_SHOW: 0.22, FREE_CHAT: 0.12 } },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Number(value.toFixed(3))
}

function buildBaseSceneAffinity(): SceneAffinityMap {
  return {
    FREE_CHAT: 0.45,
    TALK_SHOW: 0.42,
    ROUND_TABLE: 0.42,
    ROAST: 0.28,
    DEBATE: 0.3,
    SLICE_OF_LIFE: 0.34,
    STORY_LAB: 0.3,
  }
}

function pickSceneLabel(sceneAffinity: Record<string, number>): RoomSceneType {
  let best: RoomSceneType = 'FREE_CHAT'
  let bestScore = -1
  for (const scene of ROOM_SCENES) {
    const score = sceneAffinity[scene] ?? 0
    if (score > bestScore) {
      best = scene
      bestScore = score
    }
  }
  return best
}

function deriveRoleTendency(projection: AgentPublicProjection): RoomCastRole | null {
  const topScene = pickSceneLabel(projection.scene_affinity_json)
  if (projection.callback_habit >= 0.74) return 'CHRONICLER'
  if (projection.conflict_threshold <= 0.28) {
    return topScene === 'DEBATE' ? 'SKEPTIC' : 'FOIL'
  }
  if (projection.banter_style === 'playful' && topScene === 'TALK_SHOW') return 'HOST'
  if (projection.banter_style === 'sharp' && topScene === 'ROAST') return 'WILDCARD'
  if (topScene === 'ROUND_TABLE') return 'EXPLAINER'
  return 'REGULAR'
}

function deriveSpotlightPreference(projection: AgentPublicProjection): SpotlightPreference {
  const role = deriveRoleTendency(projection)
  if (role === 'HOST' || role === 'WILDCARD') return 'HIGH'
  if (role === 'CHRONICLER' || role === 'EXPLAINER') return 'MEDIUM'
  return projection.conflict_threshold <= 0.25 ? 'HIGH' : 'LOW'
}

function disclosureSanitization(input: {
  scene_affinity_json: Record<string, number>
  banter_style: string
  conflict_threshold: number
  callback_habit: number
  signature_moves_json: string[]
  follow_targets_json: string[]
  avoid_targets_json: string[]
}): SanitizedProjectionFields {
  return {
    scene_affinity_json: Object.fromEntries(
      Object.entries(input.scene_affinity_json).map(([key, value]) => [key, round(clamp(value, 0, 1.25))]),
    ),
    banter_style: input.banter_style,
    conflict_threshold: round(clamp(input.conflict_threshold, 0.1, 0.95)),
    callback_habit: round(clamp(input.callback_habit, 0.05, 0.98)),
    signature_moves_json: Array.from(new Set(input.signature_moves_json.map((item) => item.trim()).filter(Boolean))).slice(0, 6),
    disclosure_policy_json: {
      private_digest_influence: 'sanitized',
      owner_surface: 'control_state_only',
      public_prompt_scope: 'summary_only',
    },
    follow_targets_json: Array.from(new Set(input.follow_targets_json)).slice(0, 4),
    avoid_targets_json: Array.from(new Set(input.avoid_targets_json)).slice(0, 4),
  }
}

function extractSignaturePhrases(text: string): string[] {
  const chunks = text
    .split(/[，。；、,.!?！？\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4 && item.length <= 18)
  return chunks.slice(0, 2)
}

export class AgentPublicProjectionService {
  private onUpdated:
    | ((input: { agent_id: string; reason: ProjectionRefreshInput['reason'] }) => Promise<void> | void)
    | null = null

  constructor(private readonly deps: AgentPublicProjectionServiceDeps) {}

  private sanitizeResult = disclosureSanitization

  setUpdatedHook(
    hook: (input: { agent_id: string; reason: ProjectionRefreshInput['reason'] }) => Promise<void> | void,
  ): void {
    this.onUpdated = hook
  }

  async getOrBuild(agentId: string): Promise<AgentPublicProjectionView | null> {
    const existing = await this.deps.projectionRepo.get(agentId)
    if (existing) return this.toView(existing)

    const built = await this.build(agentId, { reason: 'get_or_build' })
    if (!built) return null
    const saved = await this.deps.projectionRepo.upsert(built)
    return this.toView(saved)
  }

  async getOrBuildMany(agentIds: string[]): Promise<Map<string, AgentPublicProjectionView>> {
    const rows = await this.deps.projectionRepo.list(agentIds)
    const map = new Map(rows.map((row) => [row.agent_id, this.toView(row)]))

    for (const agentId of agentIds) {
      if (map.has(agentId)) continue
      const built = await this.getOrBuild(agentId)
      if (built) map.set(agentId, built)
    }

    return map
  }

  async refresh(agentId: string, input: ProjectionRefreshInput): Promise<AgentPublicProjectionView | null> {
    const built = await this.build(agentId, input)
    if (!built) return null
    const saved = await this.deps.projectionRepo.upsert(built)
    this.emitUpdated(agentId, input.reason)
    return this.toView(saved)
  }

  async refreshFromPrivateDigest(input: {
    agent_id: string
    summary_text?: string
    sentiment?: string | null
    importance_score?: number
  }): Promise<AgentPublicProjectionView | null> {
    return this.refresh(input.agent_id, {
      reason: 'private_digest',
      private_digest: {
        summary_text: input.summary_text,
        sentiment: input.sentiment,
        importance_score: input.importance_score,
      },
    })
  }

  async refreshFromPublicObservation(input: {
    agent_id: string
    summary_text?: string
    topic_tags?: string[]
    importance_score?: number
  }): Promise<AgentPublicProjectionView | null> {
    return this.refresh(input.agent_id, {
      reason: 'public_observation',
      public_observation: {
        summary_text: input.summary_text,
        topic_tags: input.topic_tags,
        importance_score: input.importance_score,
      },
    })
  }

  private async build(
    agentId: string,
    input: ProjectionRefreshInput,
  ): Promise<Parameters<AgentPublicProjectionRepository['upsert']>[0] | null> {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) return null

    const publicPresentationPromise = this.deps.achievementChronicleService?.getPublicAuthorPresentation
      ? this.deps.achievementChronicleService.getPublicAuthorPresentation(agentId).catch((err) => {
          console.warn(`[AgentPublicProjectionService] getPublicAuthorPresentation failed for agent=${agentId}:`, err)
          return { public_projection: null, public_proof: null, top_chronicle: [] }
        })
      : Promise.resolve({ public_projection: null, public_proof: null, top_chronicle: [] })

    const [existing, publicPresentation, projectedPersona] = await Promise.all([
      this.deps.projectionRepo.get(agentId),
      publicPresentationPromise,
      this.deps.personaStateService?.getProjectedPersona(agentId).catch((err) => {
        console.warn(`[AgentPublicProjectionService] getProjectedPersona failed for agent=${agentId}:`, err)
        return null
      }),
    ])

    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const identity = resolveAgentIdentity(agent, latestConfig)
    const ownerPins = identity.contract.ownerStylePins
    const derived = this.deps.statsService?.getDerivedSync(agentId)

    const followTargets: string[] = existing?.follow_targets_json ? [...existing.follow_targets_json] : []
    const avoidTargets: string[] = existing?.avoid_targets_json ? [...existing.avoid_targets_json] : []

    if (this.deps.relationRepo) {
      const [effective, blocked] = await Promise.all([
        this.deps.relationRepo.listOutgoing(agentId, { limit: 4, state: 'effective' }),
        this.deps.relationRepo.listOutgoing(agentId, { limit: 4, state: 'blocked' }),
      ])
      followTargets.splice(0, followTargets.length, ...effective.items.map((item) => item.to_agent_id))
      avoidTargets.splice(0, avoidTargets.length, ...blocked.items.map((item) => item.to_agent_id))
    }

    if (input.relation_change) {
      if (input.relation_change.next_state === 'effective') {
        followTargets.unshift(input.relation_change.to_agent_id)
      }
      if (input.relation_change.next_state === 'blocked') {
        avoidTargets.unshift(input.relation_change.to_agent_id)
      }
    }

    const sceneAffinity: SceneAffinityMap = {
      ...buildBaseSceneAffinity(),
      ...(existing?.scene_affinity_json ?? {}),
    }

    const signatureMoves = [
      ...(existing?.signature_moves_json ?? []),
      ...extractSignaturePhrases(publicPresentation?.public_projection?.tagline ?? ''),
      ...extractSignaturePhrases(projectedPersona?.projection.visibleStyle ?? ''),
    ]

    const interestTerms = ownerPins.interests ?? []
    for (const interest of interestTerms) {
      signatureMoves.push(interest)
      for (const mapping of INTEREST_SCENE_MAP) {
        if (!mapping.pattern.test(interest)) continue
        for (const [scene, delta] of Object.entries(mapping.scenes)) {
          sceneAffinity[scene as RoomSceneType] = round((sceneAffinity[scene as RoomSceneType] ?? 0) + delta)
        }
      }
    }

    const talkativeness = derived?.chat.talkativeness_1_5 ?? 3
    const controversy = derived?.participation.controversy_appetite ?? 0.45
    const cautionRate = derived?.expression.caution_rate ?? 0.4
    const callbackDrive = derived?.memory.callback_drive ?? 0.5

    if (talkativeness >= 4) {
      sceneAffinity.FREE_CHAT = round(sceneAffinity.FREE_CHAT + 0.1)
      sceneAffinity.TALK_SHOW = round(sceneAffinity.TALK_SHOW + 0.12)
    }
    if (controversy >= 0.55) {
      sceneAffinity.DEBATE = round(sceneAffinity.DEBATE + 0.18)
      sceneAffinity.ROAST = round(sceneAffinity.ROAST + 0.08)
    }
    if (callbackDrive >= 0.62) {
      sceneAffinity.STORY_LAB = round(sceneAffinity.STORY_LAB + 0.12)
      sceneAffinity.ROUND_TABLE = round(sceneAffinity.ROUND_TABLE + 0.06)
    }

    if (input.public_observation?.topic_tags?.length) {
      for (const tag of input.public_observation.topic_tags) {
        signatureMoves.push(tag)
        for (const mapping of INTEREST_SCENE_MAP) {
          if (!mapping.pattern.test(tag)) continue
          for (const [scene, delta] of Object.entries(mapping.scenes)) {
            sceneAffinity[scene as RoomSceneType] = round((sceneAffinity[scene as RoomSceneType] ?? 0) + delta)
          }
        }
      }
    }

    let banterStyle = existing?.banter_style ?? 'balanced'
    if (derived?.expression.sarcasm_allowed && controversy >= 0.55) {
      banterStyle = 'sharp'
    } else if (talkativeness >= 4) {
      banterStyle = 'playful'
    } else if (cautionRate >= 0.7) {
      banterStyle = 'measured'
    }

    if (input.private_digest?.sentiment && /(tense|sad|guarded|negative|low)/i.test(input.private_digest.sentiment)) {
      banterStyle = 'measured'
    }

    let conflictThreshold = 0.72 - controversy * 0.45 + cautionRate * 0.12
    if (input.private_digest?.sentiment && /(excited|charged|angry|spiky)/i.test(input.private_digest.sentiment)) {
      conflictThreshold -= 0.08
    }
    if (input.private_digest?.importance_score) {
      conflictThreshold -= input.private_digest.importance_score * 0.06
    }

    let callbackHabit = callbackDrive * 0.75 + (input.public_observation?.importance_score ?? 0.45) * 0.15
    callbackHabit += publicPresentation?.top_chronicle?.length ? 0.08 : 0
    if (input.private_digest?.importance_score) {
      callbackHabit += input.private_digest.importance_score * 0.05
    }

    if (input.private_digest?.summary_text) {
      const lower = input.private_digest.summary_text.toLowerCase()
      if (lower.includes('解释') || lower.includes('梳理')) signatureMoves.push('更擅长把话说清')
      if (lower.includes('笑') || lower.includes('调侃')) signatureMoves.push('会带一点自嘲')
    }

    if (input.public_observation?.summary_text) {
      signatureMoves.push(...extractSignaturePhrases(input.public_observation.summary_text))
    }

    const sanitized = this.sanitizeResult({
      scene_affinity_json: sceneAffinity,
      banter_style: banterStyle,
      conflict_threshold: conflictThreshold,
      callback_habit: callbackHabit,
      signature_moves_json: signatureMoves,
      follow_targets_json: followTargets,
      avoid_targets_json: avoidTargets,
    })

    return {
      agent_id: agentId,
      ...sanitized,
    }
  }

  private toView(projection: AgentPublicProjection): AgentPublicProjectionView {
    const role_tendency = deriveRoleTendency(projection)
    const spotlight_preference = deriveSpotlightPreference(projection)
    const topScene = pickSceneLabel(projection.scene_affinity_json)
    const public_projection_hint = [
      `更适合 ${topScene}`,
      `banter=${projection.banter_style}`,
      projection.callback_habit >= 0.65 ? '擅长回收梗' : '更偏即时反应',
      role_tendency ? `常站 ${role_tendency}` : null,
    ].filter(Boolean).join(' · ')

    return {
      ...projection,
      role_tendency,
      spotlight_preference,
      public_projection_hint,
    }
  }

  private emitUpdated(agentId: string, reason: ProjectionRefreshInput['reason']): void {
    if (!this.onUpdated) return
    Promise.resolve(this.onUpdated({
      agent_id: agentId,
      reason,
    })).catch((error) => {
      console.error('[AgentPublicProjectionService] updated hook failed:', error)
    })
  }
}
