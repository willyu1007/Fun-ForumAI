import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { readLaunchSystemIdentityConfig } from '../launch/system-roster.js'
import {
  bucketizeAgentPresence,
  buildWorldviewSourceFingerprint,
  type AgentBioWorldviewModel,
} from '../domain/agent-bio/index.js'
import type { AchievementChronicleService } from './achievement-chronicle-service.js'
import type { AgentPublicProjectionService } from './agent-public-projection-service.js'
import type { AgentService } from './agent-service.js'
import type { PersonaStateService } from './persona-state-service.js'
import type { ChronicleRepository } from '../repos/chronicle-repository.js'
import type { RelationRepository } from '../repos/relation-repository.js'
import type { MemoryService } from './memory-service.js'
import {
  isChronicleEligibleForBiographyMaterial,
  isProductSafePublicChronicleEntry,
} from './chronicle-product-safety.js'

export interface AgentBioWorldviewServiceDeps {
  agentService: AgentService
  personaStateService?: PersonaStateService | null
  achievementChronicleService: AchievementChronicleService
  agentPublicProjectionService: AgentPublicProjectionService
  chronicleRepo: ChronicleRepository
  relationRepo?: RelationRepository | null
}

function uniqueStrings(values: Array<string | null | undefined>, limit: number): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim() ?? '')
        .filter((value) => value.length > 0),
    ),
  ).slice(0, limit)
}

function clip(value: string, maxLength = 72): string {
  const normalized = value.trim()
  if (!normalized) return ''
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}…`
}

function pickDominantSentiment(values: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    const key = value.trim().toLowerCase()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
}

function pickTopScene(sceneAffinityJson: Record<string, number> | null | undefined): string | null {
  if (!sceneAffinityJson) return null
  return Object.entries(sceneAffinityJson)
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
}

function readMoodLabel(mood: string | null | undefined): string | null {
  if (!mood) return null
  const labelMap: Record<string, string> = {
    optimistic: '偏乐观',
    neutral: '偏中性',
    critical: '带一点挑剔',
    random: '情绪跳跃',
  }
  return labelMap[mood] ?? mood
}

export class AgentBioWorldviewService {
  private memoryService: MemoryService | null = null

  constructor(private readonly deps: AgentBioWorldviewServiceDeps) {}

  attachRuntimeDeps(input: {
    memoryService?: MemoryService | null
  }): void {
    if (input.memoryService !== undefined) {
      this.memoryService = input.memoryService
    }
  }

  async compile(agentId: string, now = new Date()): Promise<{
    worldview: AgentBioWorldviewModel
    source_fingerprint: string
  } | null> {
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const identity = resolveAgentIdentity(agent, latestConfig)
    const systemIdentity = readLaunchSystemIdentityConfig(latestConfig?.config_json)

    const [personaState, projection, publicPresentation, chroniclePage, privateMemories, relationSummary] =
      await Promise.all([
        this.deps.personaStateService?.getCurrentState(agentId).catch(() => null) ?? Promise.resolve(null),
        this.deps.agentPublicProjectionService.getOrBuild(agentId).catch(() => null),
        this.deps.achievementChronicleService.getPublicAuthorPresentation(agentId).catch(() => ({
          public_projection: null,
          public_proof: null,
          top_chronicle: [],
        })),
        this.deps.chronicleRepo.findByAgent(agentId, { limit: 8 }).catch(() => ({
          items: [],
          next_cursor: null,
        })),
        this.memoryService?.listMemories(agentId, {
          limit: 4,
          source_type: 'PRIVATE_CHAT',
        }).catch(() => ({ items: [], next_cursor: null })) ?? Promise.resolve({ items: [], next_cursor: null }),
        this.loadRelationSummary(agentId),
      ])

    const ownerChronicleSummaries = chroniclePage.items
      .filter((entry) => entry.visibility === 'OWNER_ONLY' && isChronicleEligibleForBiographyMaterial(entry))
      .map((entry) => clip(entry.summary))
      .slice(0, 3)
    const privateMemorySummaries = privateMemories.items
      .map((memory) => clip(memory.summary_text))
      .slice(0, 3)
    const lastPublicAt = publicPresentation.top_chronicle[0]?.occurred_at
      ?? chroniclePage.items.find((entry) => isProductSafePublicChronicleEntry(entry))?.occurred_at
      ?? null
    const lastPrivateAt = privateMemories.items[0]?.created_at ?? null
    const presence = bucketizeAgentPresence({
      now,
      lastPublicAt,
      lastPrivateAt,
      lastRelationAt: relationSummary.last_relation_at,
      confidence:
        personaState && typeof (personaState as { confidence?: number }).confidence === 'number'
          ? (personaState as { confidence: number }).confidence
          : null,
      driftScore:
        personaState && typeof (personaState as { driftScore?: number }).driftScore === 'number'
          ? (personaState as { driftScore: number }).driftScore
          : null,
    })

    const worldview: AgentBioWorldviewModel = {
      identity: {
        display_name: agent.display_name,
        persona_seed_label: identity.summary.persona_seed_label,
        home_voice_line_id: identity.summary.home_voice_line_id,
        voice_line_label: identity.summary.home_voice_line_label,
        visible_style: identity.visiblePersona.style,
        interests: identity.visiblePersona.interests.slice(0, 4),
        mood: readMoodLabel(identity.contract.ownerStylePins.mood),
      },
      projection: {
        public_projection_hint: projection?.public_projection_hint ?? null,
        banter_style: projection?.banter_style ?? null,
        top_scene: pickTopScene(projection?.scene_affinity_json),
        signature_moves: projection?.signature_moves_json.slice(0, 3) ?? [],
      },
      system_identity: {
        agent_kind: systemIdentity ? 'system' : 'owner',
        program_role: systemIdentity?.program_role ?? null,
        visibility_role: systemIdentity?.visibility_role ?? null,
        home_community: systemIdentity?.home_community ?? null,
        stance_axis: systemIdentity?.identity_scaffold.stance_axis ?? null,
        humor_axis: systemIdentity?.identity_scaffold.humor_axis ?? null,
        empathy_axis: systemIdentity?.identity_scaffold.empathy_axis ?? null,
        narrative_axis: systemIdentity?.identity_scaffold.narrative_axis ?? null,
        signature_topics: systemIdentity?.identity_scaffold.signature_topics.slice(0, 4) ?? [],
        signature_relationships:
          systemIdentity?.identity_scaffold.signature_relationships.slice(0, 4) ?? [],
        role_promise: systemIdentity?.identity_scaffold.role_promise ?? null,
        viewer_hook_style: systemIdentity?.identity_scaffold.viewer_hook_style ?? null,
        forbidden_tones: systemIdentity?.identity_scaffold.forbidden_tones.slice(0, 4) ?? [],
        private_lane_policy: systemIdentity?.identity_scaffold.private_lane_policy ?? null,
      },
      public_history: {
        badges: (publicPresentation.public_proof?.achievement_badges ?? []).map((badge) => ({
          code: badge.code,
          name: badge.name,
          tier: badge.level ?? 1,
        })),
        tagline: publicPresentation.public_projection?.tagline ?? null,
        top_chronicle_summaries: publicPresentation.top_chronicle.map((entry) => clip(entry.summary)).slice(0, 3),
      },
      owner_history: {
        chronicle_summaries: ownerChronicleSummaries,
        private_memory_summaries: privateMemorySummaries,
        dominant_private_sentiment: pickDominantSentiment(privateMemories.items.map((item) => item.sentiment)),
      },
      relations: relationSummary.summary,
      persona_state: {
        maturity:
          personaState && typeof (personaState as { maturity?: string }).maturity === 'string'
            ? (personaState as { maturity: string }).maturity
            : null,
        confidence:
          personaState && typeof (personaState as { confidence?: number }).confidence === 'number'
            ? (personaState as { confidence: number }).confidence
            : null,
        drift_score:
          personaState && typeof (personaState as { driftScore?: number }).driftScore === 'number'
            ? (personaState as { driftScore: number }).driftScore
            : null,
      },
      presence,
      source_clauses: {
        public_safe: uniqueStrings([
          publicPresentation.public_projection?.tagline ?? null,
          ...publicPresentation.top_chronicle.map((entry) => entry.summary),
          projection?.public_projection_hint ?? null,
          systemIdentity?.identity_scaffold.role_promise ?? null,
          systemIdentity?.identity_scaffold.viewer_hook_style ?? null,
          ...(systemIdentity?.identity_scaffold.signature_topics ?? []),
          ...(systemIdentity?.identity_scaffold.signature_relationships ?? []),
          ...identity.visiblePersona.interests,
          ...projection?.signature_moves_json ?? [],
        ], 8),
        owner_only: uniqueStrings([
          systemIdentity?.identity_scaffold.private_lane_policy === 'public_only'
            ? 'public_only_private_lane'
            : null,
          ...(systemIdentity?.identity_scaffold.forbidden_tones ?? []),
          ...ownerChronicleSummaries,
          ...privateMemorySummaries,
        ], 8),
        private_header: uniqueStrings([
          systemIdentity?.identity_scaffold.viewer_hook_style ?? null,
          ownerChronicleSummaries[0] ?? null,
          privateMemorySummaries[0] ?? null,
          publicPresentation.public_projection?.tagline ?? null,
        ], 4),
        private_guard: uniqueStrings([
          ...(systemIdentity?.identity_scaffold.forbidden_tones ?? []),
          ...ownerChronicleSummaries,
          ...privateMemorySummaries,
        ], 8),
      },
    }

    const { presence: omittedPresence, ...withoutPresence } = worldview
    void omittedPresence
    return {
      worldview,
      source_fingerprint: buildWorldviewSourceFingerprint({
        worldview: withoutPresence,
      }),
    }
  }

  private async loadRelationSummary(agentId: string): Promise<{
    summary: AgentBioWorldviewModel['relations']
    last_relation_at: Date | null
  }> {
    if (!this.deps.relationRepo) {
      return {
        summary: {
          following_effective: 0,
          followers_effective: 0,
          mutual_effective: 0,
          recent_state_tags: [],
        },
        last_relation_at: null,
      }
    }

    const [followingEffective, followersEffective, mutualEffective, outgoingRecent, incomingRecent, shadowRecent] =
      await Promise.all([
        this.deps.relationRepo.countOutgoingByStates(agentId, ['effective']),
        this.deps.relationRepo.countIncomingByStates(agentId, ['effective']),
        this.deps.relationRepo.countMutualEffective(agentId),
        this.deps.relationRepo.listOutgoing(agentId, { limit: 3 }),
        this.deps.relationRepo.listIncoming(agentId, { limit: 3 }),
        this.deps.relationRepo.listOutgoing(agentId, { limit: 2, state: 'shadow' }),
      ])

    const recent = [
      ...outgoingRecent.items.map((item) => item.updated_at),
      ...incomingRecent.items.map((item) => item.updated_at),
      ...shadowRecent.items.map((item) => item.updated_at),
    ].sort((left, right) => right.getTime() - left.getTime())[0] ?? null

    const recentStateTags = uniqueStrings([
      mutualEffective > 0 ? `mutual_${Math.min(mutualEffective, 3)}` : null,
      followingEffective > 0 ? 'following_effective' : null,
      followersEffective > 0 ? 'followed_back' : null,
      shadowRecent.items.length > 0 ? 'shadow_active' : null,
    ], 4)

    return {
      summary: {
        following_effective: followingEffective,
        followers_effective: followersEffective,
        mutual_effective: mutualEffective,
        recent_state_tags: recentStateTags,
      },
      last_relation_at: recent,
    }
  }
}
