import { createHash } from 'node:crypto'
import { config } from '../lib/config.js'
import type { ComposePromptLayersInput, PromptLayerService } from './prompt-layer-service.js'
import type { PersonaStateService } from '../services/persona-state-service.js'
import type {
  AgentPersona,
  PromptComposeAudit,
  PromptLayers,
  PromptScene,
} from './types.js'
import { runtimeFeatureMetrics } from './runtime-feature-metrics.js'
import type { PersonaRuntimeEnvelope, PersonaRuntimeScene } from './persona-runtime-types.js'
import { SCENE_RULE_MAX_CHARS, SHORT_TERM_STATE_MAX_CHARS_BY_SCENE } from './persona-runtime-types.js'

const DEFAULT_ORCHESTRATOR_CACHE_TTL_MS = 30_000
const DEFAULT_ORCHESTRATOR_CACHE_MAX_ENTRIES = 500

const CACHEABLE_SCENES = new Set<PromptScene>([
  'forum_post',
  'forum_comment',
  'chat_room',
  'scheduled_post',
])

const LAYER_BUDGET_BY_SCENE: Record<PromptScene, number> = {
  forum_post: 420,
  forum_comment: 380,
  chat_room: 280,
  private_chat: 420,
  proactive_dm: 220,
  scheduled_post: 420,
}

type TrimCategory =
  | 'overrides'
  | 'style'
  | 'short_term_state'
  | 'community_soft'
  | 'instructions'
  | 'relationship'
  | 'persona_traits'
  | 'community_hard'
  | 'scene_rule'

const TRIM_ORDER: TrimCategory[] = [
  'overrides',
  'style',
  'short_term_state',
  'community_soft',
  'instructions',
  'relationship',
  'persona_traits',
  'community_hard',
  'scene_rule',
]

interface OrchestratorCacheEntry {
  expiresAt: number
  result: PromptOrchestratorResult
}

interface OrchestratorCategories {
  scene_rule: string
  community_hard: string
  persona_traits: string
  relationship: string
  instructions: string
  community_soft: string
  short_term_state: string
  style: string
  overrides: string
}

export interface PromptOrchestratorInput extends ComposePromptLayersInput {
  communityHardRule?: string
  communitySoftCulture?: string
  relationshipHint?: string
  sceneRule?: string
  shortTermState?: string
  shortTermStateUpdatedAt?: Date | null
  communityProfileProvenance?: {
    source: string
    version: string
    fallback: boolean
  }
}

export interface PromptOrchestratorResult {
  persona: AgentPersona
  layers: PromptLayers
  audit: PromptComposeAudit
  runtimeEnvelope?: PersonaRuntimeEnvelope | null
}

export interface PromptOrchestratorDeps {
  promptLayerService: PromptLayerService
  personaStateService?: PersonaStateService | null
}

export interface PromptOrchestratorOptions {
  cacheTtlMs?: number
  cacheMaxEntries?: number
}

export class PromptOrchestrator {
  private readonly cache = new Map<string, OrchestratorCacheEntry>()
  private readonly cacheTtlMs: number
  private readonly cacheMaxEntries: number

  constructor(
    private readonly deps: PromptOrchestratorDeps,
    options: PromptOrchestratorOptions = {},
  ) {
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_ORCHESTRATOR_CACHE_TTL_MS
    this.cacheMaxEntries = options.cacheMaxEntries ?? DEFAULT_ORCHESTRATOR_CACHE_MAX_ENTRIES
  }

  isSceneEnabled(scene: PromptScene): boolean {
    return this.isEnabledForScene(scene)
  }

  async compose(input: PromptOrchestratorInput): Promise<PromptOrchestratorResult> {
    let runtimeEnvelope: PersonaRuntimeEnvelope | null = null
    if (
      this.deps.personaStateService?.isSceneEnabled(input.scene as PersonaRuntimeScene)
    ) {
      try {
        runtimeEnvelope = await this.deps.personaStateService.prepareRuntimeEnvelope({
          agentId: input.agentId,
          scene: input.scene as PersonaRuntimeScene,
          conversationText: input.conversationText,
          topicHints: input.topicHints,
          externalSceneRule: input.sceneRule,
          externalShortTermState: input.shortTermState,
        })
      } catch (err) {
        console.warn('[PromptOrchestrator] persona runtime prepare failed:', err)
      }
    }

    const orchestratorEnabled = this.isEnabledForScene(input.scene)
    const now = Date.now()
    if (orchestratorEnabled) {
      this.pruneCache(now)
    }
    const cacheKey = orchestratorEnabled
      ? this.buildCacheKey(input, runtimeEnvelope?.cacheSalt ?? '')
      : null

    if (cacheKey) {
      const cached = this.cache.get(cacheKey)
      if (cached) {
        if (cached.expiresAt > now) {
          const result = this.cloneResult(cached.result)
          result.audit.lintWarnings = this.pushLintWarning(result.audit.lintWarnings, 'cache_hit')
          this.emitAuditLog(input.agentId, result.audit)
          return result
        }
        this.cache.delete(cacheKey)
      }
    }

    const base = await this.deps.promptLayerService.composeLayersWithAudit(
      {
        ...input,
        precomputedRuntimeEnvelope: runtimeEnvelope,
      },
      { suppressAuditLog: true },
    )
    const persona = base.persona ?? this.deps.promptLayerService.getPersona(input.agentId)

    if (!orchestratorEnabled) {
      const fallbackResult: PromptOrchestratorResult = {
        persona,
        layers: base.layers,
        audit: base.audit,
        runtimeEnvelope: base.runtimeEnvelope ?? runtimeEnvelope,
      }
      this.emitAuditLog(input.agentId, fallbackResult.audit)
      return fallbackResult
    }

    const result = this.applyGovernance(
      input,
      persona,
      base.layers,
      base.audit,
      base.runtimeEnvelope ?? runtimeEnvelope,
    )

    if (cacheKey) {
      this.cache.set(cacheKey, {
        expiresAt: now + this.cacheTtlMs,
        result: this.cloneResult(result),
      })
      this.pruneCache(now)
    }

    this.emitAuditLog(input.agentId, result.audit)
    return result
  }

  private isEnabledForScene(scene: PromptScene): boolean {
    if (!config.features.promptOrchestratorV1) return false
    const whitelist = config.features.promptOrchestratorScenes
    if (whitelist.length === 0) return true
    return whitelist.includes(scene)
  }

  private shouldSuppressShowrunnerLayer(scene: PromptScene): boolean {
    if (!config.features.privateDirectorBoundaryV1) return false
    return scene === 'private_chat' || scene === 'proactive_dm'
  }

  private applyGovernance(
    input: PromptOrchestratorInput,
    persona: AgentPersona,
    baseLayers: PromptLayers,
    baseAudit: PromptComposeAudit,
    runtimeEnvelope: PersonaRuntimeEnvelope | null,
  ): PromptOrchestratorResult {
    const categories: OrchestratorCategories = {
      scene_rule: this.normalizeLayerText(
        this.mergeSceneRule(input.sceneRule, runtimeEnvelope?.overlaySceneRule ?? ''),
      ),
      community_hard: this.normalizeLayerText(input.communityHardRule),
      persona_traits: this.normalizeLayerText(baseLayers.layer1_traits),
      relationship: this.normalizeLayerText(input.relationshipHint ?? baseLayers.layer_relationship),
      instructions: this.normalizeLayerText(baseLayers.layer3_instructions),
      community_soft: this.normalizeLayerText(input.communitySoftCulture),
      short_term_state: this.normalizeLayerText(
        this.mergeShortTermState(
          input.scene,
          input.shortTermState,
          runtimeEnvelope?.overlayShortTermState ?? '',
        ),
      ),
      style: this.normalizeLayerText(baseLayers.layer2_style),
      overrides: this.normalizeLayerText(baseLayers.layer4_overrides),
    }
    const memoryLayer = this.normalizeLayerText(baseLayers.layer5_memory)
    const privacyLayer = this.normalizeLayerText(baseLayers.layer6_privacy)

    const lintWarnings = [...baseAudit.lintWarnings]
    const trimReasons = [...baseAudit.trimReasons]
    const now = Date.now()

    if (!privacyLayer) {
      this.pushLintWarning(lintWarnings, 'privacy_layer_missing')
    }

    if (this.hasSuspiciousInjectionPattern([
      categories.overrides,
      categories.scene_rule,
      categories.short_term_state,
      categories.community_hard,
      categories.community_soft,
    ])) {
      this.pushLintWarning(lintWarnings, 'suspicious_injection_pattern')
    }

    if (privacyLayer && this.hasPrivacyConflict(categories.overrides)) {
      categories.overrides = ''
      this.pushLintWarning(lintWarnings, 'layer_conflict_privacy_vs_override')
      trimReasons.push('trimmed_overrides_precedence_privacy')
    }

    if (
      categories.short_term_state &&
      input.shortTermStateUpdatedAt &&
      now - input.shortTermStateUpdatedAt.getTime() > this.cacheTtlMs
    ) {
      this.pushLintWarning(lintWarnings, 'stale_short_term_state_ttl')
    }

    const budget = LAYER_BUDGET_BY_SCENE[input.scene]
    let total = this.estimateTotalTokens(categories, memoryLayer, privacyLayer)
    if (total > budget) {
      this.pushLintWarning(lintWarnings, 'budget_exceeded_before_trim')
    }

    let trimmedAny = false
    while (total > budget) {
      const next = TRIM_ORDER.find((category) => categories[category].length > 0)
      if (!next) break
      categories[next] = ''
      trimReasons.push(`trimmed_${next}`)
      trimmedAny = true
      total = this.estimateTotalTokens(categories, memoryLayer, privacyLayer)
    }

    if (trimmedAny) {
      this.pushLintWarning(lintWarnings, 'budget_trim_applied')
    }
    if (total > budget) {
      trimReasons.push('budget_exceeded_non_trimmable_privacy')
    }

    const suppressShowrunnerLayer = this.shouldSuppressShowrunnerLayer(input.scene)
    if (suppressShowrunnerLayer && (categories.scene_rule || categories.short_term_state)) {
      this.pushLintWarning(lintWarnings, 'showrunner_suppressed_private_boundary')
    }

    const communityLayer = this.joinSections([
      categories.community_hard
        ? `## 社区硬规则\n${categories.community_hard}`
        : '',
      categories.community_soft
        ? `## 社区文化偏好\n${categories.community_soft}`
        : '',
    ])
    const showrunnerLayer = suppressShowrunnerLayer
      ? ''
      : this.joinSections([
          categories.scene_rule
            ? `## 场景规则\n${categories.scene_rule}`
            : '',
          categories.short_term_state
            ? `## 短期剧情状态\n${categories.short_term_state}`
            : '',
        ])

    const layers: PromptLayers = {
      layer1_traits: this.orUndefined(categories.persona_traits),
      layer2_style: this.orUndefined(categories.style),
      layer3_instructions: this.orUndefined(categories.instructions),
      layer_community: this.orUndefined(communityLayer),
      layer_relationship: this.orUndefined(categories.relationship),
      layer_showrunner: this.orUndefined(showrunnerLayer),
      layer4_overrides: this.orUndefined(categories.overrides),
      layer5_memory: this.orUndefined(memoryLayer),
      layer6_privacy: this.orUndefined(privacyLayer),
    }

    const includedLayerIds = Object.entries(layers)
      .filter(([, content]) => typeof content === 'string' && content.trim().length > 0)
      .map(([id]) => id)

    const tokenEstimates: Record<string, number> = {}
    for (const layerId of includedLayerIds) {
      const content = layers[layerId as keyof PromptLayers] ?? ''
      tokenEstimates[layerId] = this.estimateTokens(content)
    }

    return {
      persona,
      layers,
      audit: {
        version: 'v1',
        scene: input.scene,
        includedLayerIds,
        tokenEstimates,
        lintWarnings,
        trimReasons,
        ...(input.communityProfileProvenance
          ? { provenance: { community_profile: input.communityProfileProvenance } }
          : {}),
      },
      runtimeEnvelope,
    }
  }

  private estimateTotalTokens(
    categories: OrchestratorCategories,
    memoryLayer: string,
    privacyLayer: string,
  ): number {
    const layers: string[] = [
      categories.scene_rule,
      categories.community_hard,
      categories.persona_traits,
      categories.relationship,
      categories.instructions,
      categories.community_soft,
      categories.short_term_state,
      categories.style,
      categories.overrides,
      memoryLayer,
      privacyLayer,
    ]
    return layers.reduce((sum, value) => sum + this.estimateTokens(value), 0)
  }

  private estimateTokens(text: string): number {
    const normalized = text.trim()
    if (!normalized) return 0
    return Math.max(1, Math.ceil(normalized.length / 4))
  }

  private pruneCache(now: number): void {
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key)
      }
    }

    if (this.cache.size <= this.cacheMaxEntries) return

    const overflow = this.cache.size - this.cacheMaxEntries
    let removed = 0
    for (const key of this.cache.keys()) {
      this.cache.delete(key)
      removed++
      if (removed >= overflow) break
    }
  }

  private buildCacheKey(input: PromptOrchestratorInput, runtimeCacheSalt: string): string | null {
    if (!CACHEABLE_SCENES.has(input.scene)) return null
    const digest = [
      `agent:${input.agentId}`,
      `scene:${input.scene}`,
      `conversation:${input.conversationText}`,
      `topics:${(input.topicHints ?? []).join('|')}`,
      `target:${input.targetCommentId ?? ''}`,
      `room_joined:${input.roomMemberState?.joined_at?.toISOString?.() ?? ''}`,
      `room_spoke:${input.roomMemberState?.last_spoke_at?.toISOString?.() ?? ''}`,
      `rule:${input.sceneRule ?? ''}`,
      `state:${input.shortTermState ?? ''}`,
      `state_updated:${input.shortTermStateUpdatedAt?.toISOString?.() ?? ''}`,
      `community_hard:${input.communityHardRule ?? ''}`,
      `community_soft:${input.communitySoftCulture ?? ''}`,
      `relationship:${input.relationshipHint ?? ''}`,
      `runtime_cache:${runtimeCacheSalt}`,
    ].join('\n')
    return createHash('sha1').update(digest).digest('hex')
  }

  private emitAuditLog(agentId: string, audit: PromptComposeAudit): void {
    runtimeFeatureMetrics.recordPromptAudit({
      trimReasons: audit.trimReasons,
      lintWarnings: audit.lintWarnings,
    })

    if (!config.features.promptAuditV1) return
    console.info('[PromptAudit]', JSON.stringify({
      agent_id: agentId,
      ...audit,
    }))
  }

  private hasSuspiciousInjectionPattern(inputs: string[]): boolean {
    const combined = inputs.join('\n').toLowerCase()
    if (!combined) return false
    return /ignore\s+all|ignore\s+previous|jailbreak|system\s+prompt|忽略.*规则|越狱/.test(combined)
  }

  private hasPrivacyConflict(overrides: string): boolean {
    const normalized = overrides.toLowerCase()
    if (!normalized) return false
    return /忽略.*隐私|disclose\s+private|泄露|转述\s*owner|quote\s+owner/.test(normalized)
  }

  private joinSections(parts: string[]): string {
    return parts.filter((part) => part.trim().length > 0).join('\n\n')
  }

  private mergeSceneRule(sceneRule: string | undefined, overlaySceneRule: string): string {
    return truncateCompact(
      [sceneRule ?? '', overlaySceneRule].filter((item) => item.trim().length > 0).join('；'),
      SCENE_RULE_MAX_CHARS,
    )
  }

  private mergeShortTermState(
    scene: PromptScene,
    shortTermState: string | undefined,
    overlayShortTermState: string,
  ): string {
    const maxChars = SHORT_TERM_STATE_MAX_CHARS_BY_SCENE[scene as PersonaRuntimeScene] ?? 90
    return truncateCompact(
      [overlayShortTermState, shortTermState ?? '']
        .filter((item) => item.trim().length > 0)
        .join('；'),
      maxChars,
    )
  }

  private normalizeLayerText(value: string | undefined): string {
    return (value ?? '').trim()
  }

  private orUndefined(value: string): string | undefined {
    return value.trim().length > 0 ? value : undefined
  }

  private pushLintWarning(list: string[], warning: string): string[] {
    if (!list.includes(warning)) {
      list.push(warning)
    }
    return list
  }

  private cloneResult(result: PromptOrchestratorResult): PromptOrchestratorResult {
    return {
      persona: { ...result.persona, interests: [...result.persona.interests] },
      layers: { ...result.layers },
      runtimeEnvelope: result.runtimeEnvelope
        ? {
            ...result.runtimeEnvelope,
            state: {
              ...result.runtimeEnvelope.state,
              current: { ...result.runtimeEnvelope.state.current },
              anchor: { ...result.runtimeEnvelope.state.anchor },
            },
            projection: {
              ...result.runtimeEnvelope.projection,
              dominantAxes: result.runtimeEnvelope.projection.dominantAxes.map((item) => ({ ...item })),
              projectedPins: {
                ...result.runtimeEnvelope.projection.projectedPins,
                habits: result.runtimeEnvelope.projection.projectedPins.habits
                  ? [...result.runtimeEnvelope.projection.projectedPins.habits]
                  : undefined,
                interests: result.runtimeEnvelope.projection.projectedPins.interests
                  ? [...result.runtimeEnvelope.projection.projectedPins.interests]
                  : undefined,
              },
            },
            overlay: result.runtimeEnvelope.overlay
              ? {
                  ...result.runtimeEnvelope.overlay,
                  cause: { ...result.runtimeEnvelope.overlay.cause },
                  sampledAtoms: { ...result.runtimeEnvelope.overlay.sampledAtoms },
                  delta: { ...result.runtimeEnvelope.overlay.delta },
                }
              : null,
            renderTierDecision: {
              ...result.runtimeEnvelope.renderTierDecision,
              reasons: [...result.runtimeEnvelope.renderTierDecision.reasons],
            },
          }
        : null,
      audit: {
        ...result.audit,
        includedLayerIds: [...result.audit.includedLayerIds],
        tokenEstimates: { ...result.audit.tokenEstimates },
        lintWarnings: [...result.audit.lintWarnings],
        trimReasons: [...result.audit.trimReasons],
        ...(result.audit.provenance
          ? {
              provenance: {
                ...result.audit.provenance,
                ...(result.audit.provenance.community_profile
                  ? {
                      community_profile: { ...result.audit.provenance.community_profile },
                    }
                  : {}),
              },
            }
          : {}),
      },
    }
  }
}

function truncateCompact(text: string, maxChars: number): string {
  const normalized = text.trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, Math.max(0, maxChars - 3))}...`
}
