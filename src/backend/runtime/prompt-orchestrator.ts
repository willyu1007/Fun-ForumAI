import { createHash } from 'node:crypto'
import { config } from '../lib/config.js'
import { getPromptSceneBudgetConfig } from './prompt-budget-config.js'
import type { ComposePromptLayersInput, PromptLayerService } from './prompt-layer-service.js'
import type { PersonaStateService } from '../services/persona-state-service.js'
import type {
  AgentPersona,
  CurrentContextSource,
  PromptBudgetDecision,
  PromptComposeAudit,
  PromptControlTier,
  PromptLayers,
  PromptLocalLayerEnvelope,
  PromptMemoryTier,
  PromptRequestEnvelope,
  PromptScene,
  PromptOverflowReason,
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

const CONTROL_TIER_ORDER: PromptControlTier[] = ['expanded', 'compact', 'minimal']
const MEMORY_TIER_ORDER: PromptMemoryTier[] = [
  'full',
  'compact',
  'sparse',
  'minimal',
  'drop_low_value',
]

const CURRENT_CONTEXT_LABELS: Record<string, string> = {
  post_body: '当前帖子',
  thread_excerpt: '公开线程',
  target_comment: '目标评论',
  community_context: '社区公开背景',
  scheduler_context: '调度上下文',
  owner_latest_input: 'Owner 最新输入',
  session_recent_turns: '最近私聊',
  room_recent_turns: '房间最近发言',
  room_program_context: '当前房间节目上下文',
  thread_or_scene_continuity: '场景连续性',
  trigger_context: '触发上下文',
  conversation_excerpt: '当前对话片段',
}

const HARD_CONTROL_SOURCE_KINDS = new Set([
  'local_intent',
  'boundary_control',
])

const COMPACT_CONTROL_SOURCE_KINDS = new Set([
  'relationship_context',
  'session_meta',
])

const SOURCE_PRIORITY_WEIGHT: Record<NonNullable<CurrentContextSource['priority']>, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

interface OrchestratorCacheEntry {
  expiresAt: number
  result: PromptOrchestratorResult
}

interface BlockVariantSet {
  minimal: string
  compact: string
  expanded: string
}

interface MemoryVariantSet {
  full: string
  compact: string
  sparse: string
  minimal: string
  drop_low_value: string
}

interface SourcePartition {
  hardControlSources: CurrentContextSource[]
  compactControlSources: CurrentContextSource[]
  currentContextSources: CurrentContextSource[]
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
  }
  currentContextSources?: CurrentContextSource[]
  requestEnvelope?: Partial<PromptRequestEnvelope>
}

export type PromptOrchestratorV2Input = PromptOrchestratorInput

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
    void scene
    return true
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

    const now = Date.now()
    this.pruneCache(now)
    const cacheKey = this.buildCacheKey(input, runtimeEnvelope?.cacheSalt ?? '')

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

    const result = this.applyGovernance(
      input,
      persona,
      base.layers,
      base.audit,
      base.runtimeEnvelope ?? runtimeEnvelope,
      base.memoryContext ?? null,
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

  private applyGovernance(
    input: PromptOrchestratorInput,
    persona: AgentPersona,
    baseLayers: PromptLayers,
    baseAudit: PromptComposeAudit,
    runtimeEnvelope: PersonaRuntimeEnvelope | null,
    memoryContext: {
      formatted: string
      renders?: Partial<Record<PromptMemoryTier, { text: string; tokenEstimate: number }>>
    } | null,
  ): PromptOrchestratorResult {
    const lintWarnings = [...baseAudit.lintWarnings]
    const trimReasons = [...baseAudit.trimReasons]
    const isPrivateBoundaryScene = input.scene === 'private_chat' || input.scene === 'proactive_dm'

    const sceneConfig = getPromptSceneBudgetConfig(input.scene)
    const requestEnvelope = this.resolveRequestEnvelope(input)
    requestEnvelope.output_reserve = sceneConfig.request_budget.output_reserve
    const localLayerEnvelope = this.buildLocalLayerEnvelope(sceneConfig, requestEnvelope)

    const privacyLayer = this.normalizeLayerText(baseLayers.layer6_privacy)
    if (!privacyLayer) {
      this.pushLintWarning(lintWarnings, 'privacy_layer_missing')
    }

    const mergedSceneRule = this.normalizeLayerText(
      this.mergeSceneRule(input.sceneRule, runtimeEnvelope?.overlaySceneRule ?? ''),
    )
    const mergedShortTermState = this.normalizeLayerText(
      this.mergeShortTermState(
        input.scene,
        input.shortTermState,
        runtimeEnvelope?.overlayShortTermState ?? '',
      ),
    )
    if (
      mergedShortTermState &&
      input.shortTermStateUpdatedAt &&
      Date.now() - input.shortTermStateUpdatedAt.getTime() > this.cacheTtlMs
    ) {
      this.pushLintWarning(lintWarnings, 'stale_short_term_state_ttl')
    }
    if (
      this.hasSuspiciousInjectionPattern(input.sceneRule)
      || this.hasSuspiciousInjectionPattern(input.conversationText)
      || (input.currentContextSources ?? []).some((source) => this.hasSuspiciousInjectionPattern(source.text))
    ) {
      this.pushLintWarning(lintWarnings, 'suspicious_injection_pattern')
    }
    if (
      isPrivateBoundaryScene
      && (
        this.normalizeLayerText(baseLayers.layer_showrunner)
        || mergedSceneRule
        || mergedShortTermState
      )
    ) {
      this.pushLintWarning(lintWarnings, 'showrunner_suppressed_private_boundary')
    }

    const partitionedSources = this.partitionSources(
      input.currentContextSources?.length
        ? input.currentContextSources
        : this.buildFallbackSources(input),
    )
    const overridesConflictWithPrivacy = this.hasPrivacyOverrideConflict(
      privacyLayer,
      baseLayers.layer4_overrides,
    )
    const effectiveOverridesText = overridesConflictWithPrivacy
      ? undefined
      : baseLayers.layer4_overrides
    if (overridesConflictWithPrivacy) {
      this.pushLintWarning(lintWarnings, 'layer_conflict_privacy_vs_override')
      trimReasons.push('trimmed_overrides_precedence_privacy')
    }
    const overrides = this.classifyOverrides(effectiveOverridesText)
    if (overrides.unclassifiedCount > 0) {
      this.pushLintWarning(lintWarnings, 'override_defaulted_to_soft_expression')
    }

    const hardSections = [
      { heading: '## 隐私与边界', body: privacyLayer },
      { heading: '## 场景约束', body: mergedSceneRule },
      { heading: '## Local Intent', body: this.renderSources(partitionedSources.hardControlSources, 'expanded') },
      { heading: '## 社区硬规则', body: this.normalizeLayerText(input.communityHardRule) },
      { heading: '## 硬覆盖', body: overrides.hard },
    ]
    const compactSections = [
      { heading: '## 人格核心', body: this.normalizeLayerText(baseLayers.layer1_traits) },
      { heading: '## 表达与执行', body: this.normalizeLayerText(baseLayers.layer3_instructions) },
      {
        heading: '## 关系与连续性',
        body: this.joinSections([
          this.normalizeLayerText(input.relationshipHint ?? baseLayers.layer_relationship),
          mergedShortTermState ? `短期状态：${mergedShortTermState}` : '',
          this.renderSources(partitionedSources.compactControlSources, 'compact'),
        ]),
      },
      { heading: '## 紧凑覆盖', body: overrides.compact },
    ]
    const softSections = [
      { heading: '## 风格表达', body: this.normalizeLayerText(baseLayers.layer2_style) },
      { heading: '## 社区软文化', body: this.normalizeLayerText(input.communitySoftCulture) },
      { heading: '## 软覆盖', body: overrides.soft },
    ]

    const currentContextVariants = this.buildCurrentContextVariants(partitionedSources.currentContextSources)
    const hardVariants = this.buildSectionVariants(hardSections)
    const compactVariants = this.buildSectionVariants(compactSections)
    const softVariants = this.buildSectionVariants(softSections)
    const memoryVariants = this.buildMemoryVariants(memoryContext?.renders, memoryContext?.formatted ?? '')

    const controlTier = this.pickControlTier(
      sceneConfig,
      localLayerEnvelope,
      hardVariants,
      compactVariants,
      currentContextVariants,
    )
    if (controlTier !== sceneConfig.compiler_policy.max_control_tier) {
      trimReasons.push(`trimmed_control_tier_${controlTier}`)
    }
    const hardControlBlock = hardVariants[controlTier]
    const compactControlBlock = compactVariants[controlTier]
    const currentContextBlock = currentContextVariants[controlTier]

    const guaranteedBudgets = this.computeBucketBudgets(sceneConfig, localLayerEnvelope.local_target)
    const maxBudgets = this.computeBucketBudgets(sceneConfig, localLayerEnvelope.local_hard, {
      useMax: true,
    })

    const hardControlTokens = this.estimateTokens(hardControlBlock)
    const compactControlTokens = this.estimateTokens(compactControlBlock)
    const currentContextTokens = this.estimateTokens(currentContextBlock)
    const minimalControlTokens =
      this.estimateTokens(hardVariants.minimal) + this.estimateTokens(compactVariants.minimal)

    let overflowReason: PromptOverflowReason | null = null
    if (minimalControlTokens > localLayerEnvelope.local_target) {
      overflowReason = 'control_floor_exceeds_target_budget'
      this.pushLintWarning(lintWarnings, 'scene_contract_error_control_floor')
    } else if (
      minimalControlTokens + this.estimateTokens(currentContextVariants.minimal)
      > localLayerEnvelope.local_target
    ) {
      overflowReason = 'current_context_exceeds_target_budget'
      this.pushLintWarning(lintWarnings, 'scene_contract_error_current_context_floor')
    }

    const usedWithoutMemory = hardControlTokens + compactControlTokens + currentContextTokens
    const remainingTargetAfterFloors = Math.max(0, localLayerEnvelope.local_target - usedWithoutMemory)
    const remainingHardAfterFloors = Math.max(0, localLayerEnvelope.local_hard - usedWithoutMemory)
    const memoryBucketTarget = Math.min(guaranteedBudgets.memory.preferred, remainingTargetAfterFloors)
    const memoryTokenCeiling = Math.min(maxBudgets.memory.max, remainingHardAfterFloors)

    const memorySelection = this.pickMemoryTier(
      memoryVariants,
      sceneConfig.compiler_policy.default_memory_tier,
      memoryBucketTarget,
      memoryTokenCeiling,
    )
    if (memorySelection.tier !== sceneConfig.compiler_policy.default_memory_tier) {
      trimReasons.push(`trimmed_memory_tier_${memorySelection.tier}`)
    }
    const memoryBlock = memorySelection.text
    const memoryTokens = memorySelection.tokenEstimate

    if (
      memoryTokens > 0
      && memoryTokens > memoryBucketTarget
      && hardControlTokens > 0
      && overflowReason === null
    ) {
      overflowReason = 'budget_exceeded_due_to_memory'
    }
    if (
      memoryTokens > 0
      && memorySelection.tier !== 'full'
      && memoryTokens <= memoryTokenCeiling
      && remainingHardAfterFloors < memoryBucketTarget
      && overflowReason === null
    ) {
      overflowReason = 'hard_ceiling_enforced_memory_compacted'
    }
    if (
      memoryTokens === 0
      && privacyLayer
      && guaranteedBudgets.memory.guaranteed > 0
      && overflowReason === null
    ) {
      overflowReason = 'budget_exceeded_due_to_privacy_and_memory_floor'
    }

    const usedBeforeSoft = usedWithoutMemory + memoryTokens
    const softBudgetTarget = Math.max(0, guaranteedBudgets.soft_expression.preferred)
    const softBudgetHard = Math.max(0, maxBudgets.soft_expression.max)
    let softExpressionBlock = ''
    let softExpressionTokens = 0
    const preferredSoft = softVariants[controlTier]
    const preferredSoftTokens = this.estimateTokens(preferredSoft)
    if (preferredSoftTokens > 0) {
      const fitsTarget = usedBeforeSoft + preferredSoftTokens <= localLayerEnvelope.local_target
      const fitsSoftCeiling = usedBeforeSoft + preferredSoftTokens <= localLayerEnvelope.local_soft
      const fitsHard = usedBeforeSoft + preferredSoftTokens <= localLayerEnvelope.local_hard
      if (fitsTarget && preferredSoftTokens <= softBudgetTarget) {
        softExpressionBlock = preferredSoft
        softExpressionTokens = preferredSoftTokens
      } else if (
        sceneConfig.compiler_policy.allow_soft_overflow
        && fitsSoftCeiling
        && fitsHard
        && preferredSoftTokens <= softBudgetHard
      ) {
        softExpressionBlock = preferredSoft
        softExpressionTokens = preferredSoftTokens
        overflowReason ??= 'soft_overflow_applied'
      } else if (softVariants.minimal) {
        softExpressionBlock = softVariants.minimal
        softExpressionTokens = Math.min(
          this.estimateTokens(softExpressionBlock),
          Math.max(0, localLayerEnvelope.local_hard - usedBeforeSoft),
        )
        softExpressionBlock = softExpressionTokens > 0
          ? this.trimToTokens(softExpressionBlock, softExpressionTokens)
          : ''
        softExpressionTokens = this.estimateTokens(softExpressionBlock)
        if (softExpressionTokens > 0) {
          trimReasons.push('trimmed_soft_expression')
        }
      }
    }

    const estimatedTotalInput = requestEnvelope.static_system_tokens
      + requestEnvelope.route_wrapper_tokens
      + requestEnvelope.tool_tokens
      + requestEnvelope.current_user_input_tokens
      + hardControlTokens
      + compactControlTokens
      + currentContextTokens
      + memoryTokens
      + softExpressionTokens

    if (
      overflowReason === null
      && estimatedTotalInput > localLayerEnvelope.request_hard_ceiling
    ) {
      overflowReason = 'budget_exceeded_after_control_trim'
    }
    if (trimReasons.some((reason) => reason.startsWith('trimmed_'))) {
      this.pushLintWarning(lintWarnings, 'budget_trim_applied')
    }

    const bucketTokens = {
      hard_control: hardControlTokens,
      compact_control: compactControlTokens,
      current_context: currentContextTokens,
      memory: memoryTokens,
      soft_expression: softExpressionTokens,
    }
    const budgetDecision: PromptBudgetDecision = {
      target_budget: localLayerEnvelope.local_target,
      soft_ceiling: localLayerEnvelope.local_soft,
      hard_ceiling: localLayerEnvelope.local_hard,
      actual_input_estimate: estimatedTotalInput,
      estimated_total_input: estimatedTotalInput,
      control_tier_applied: controlTier,
      memory_tier_applied: memorySelection.tier,
      bucket_tokens: bucketTokens,
      bucket_survival_ratio: {
        hard_control: this.computeSurvivalRatio(
          hardControlTokens,
          guaranteedBudgets.hard_control.preferred,
        ),
        compact_control: this.computeSurvivalRatio(
          compactControlTokens,
          guaranteedBudgets.compact_control.preferred,
        ),
        current_context: this.computeSurvivalRatio(
          currentContextTokens,
          guaranteedBudgets.current_context.preferred,
        ),
        memory: this.computeSurvivalRatio(memoryTokens, guaranteedBudgets.memory.preferred),
        soft_expression: this.computeSurvivalRatio(
          softExpressionTokens,
          guaranteedBudgets.soft_expression.preferred,
        ),
      },
      overflow_reason: overflowReason,
      warnings: [...lintWarnings],
    }

    const layers: PromptLayers = {
      ...baseLayers,
      layer4_overrides: this.orUndefined(effectiveOverridesText ?? ''),
      layer_showrunner: isPrivateBoundaryScene ? undefined : baseLayers.layer_showrunner,
      layer5_memory: memoryBlock || undefined,
      hard_control_block: this.orUndefined(hardControlBlock),
      compact_control_block: this.orUndefined(compactControlBlock),
      current_context_block: this.orUndefined(currentContextBlock),
      memory_block: this.orUndefined(memoryBlock),
      soft_expression_block: this.orUndefined(softExpressionBlock),
    }

    const includedLayerIds = Array.from(new Set([
      ...this.collectLegacyIncludedLayerIds(baseLayers, layers, isPrivateBoundaryScene),
      ...[
        ['hard_control_block', layers.hard_control_block],
        ['compact_control_block', layers.compact_control_block],
        ['current_context_block', layers.current_context_block],
        ['memory_block', layers.memory_block],
        ['soft_expression_block', layers.soft_expression_block],
      ]
        .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
        .map(([key]) => key),
    ]))

    const tokenEstimates: Record<string, number> = {
      hard_control_block: hardControlTokens,
      compact_control_block: compactControlTokens,
      current_context_block: currentContextTokens,
      memory_block: memoryTokens,
      soft_expression_block: softExpressionTokens,
    }

    const normalizedProvenance: PromptComposeAudit['provenance'] | undefined = baseAudit.provenance
      ? cloneValue(baseAudit.provenance)
      : (
          input.communityProfileProvenance
            ? {
                community_profile: {
                  source: input.communityProfileProvenance.source,
                  version: input.communityProfileProvenance.version,
                },
              }
            : undefined
        )
    if (normalizedProvenance && input.communityProfileProvenance) {
      normalizedProvenance.community_profile = {
        source: input.communityProfileProvenance.source,
        version: input.communityProfileProvenance.version,
      }
    }
    if (normalizedProvenance?.private_memory) {
      normalizedProvenance.private_memory.runtime_memory_bucket_target = memoryBucketTarget
      normalizedProvenance.private_memory.runtime_memory_token_ceiling = memoryTokenCeiling
      normalizedProvenance.private_memory.runtime_memory_tier_applied = memorySelection.tier
      normalizedProvenance.private_memory.owner_budget_divergence_reason =
        normalizedProvenance.private_memory.owner_memory_budget_preference !== undefined
          && normalizedProvenance.private_memory.owner_memory_budget_preference !== memoryBucketTarget
          ? this.resolveMemoryDivergenceReason(
              normalizedProvenance.private_memory.owner_memory_budget_preference,
              memoryBucketTarget,
              memoryTokenCeiling,
              usedWithoutMemory,
              localLayerEnvelope.local_target,
            )
          : null
    }

    return {
      persona,
      layers,
      audit: {
        version: 'v2',
        scene: input.scene,
        includedLayerIds,
        tokenEstimates,
        lintWarnings,
        trimReasons,
        requestEnvelope,
        localLayerEnvelope,
        budgetDecision,
        ...(normalizedProvenance ? { provenance: normalizedProvenance } : {}),
      },
      runtimeEnvelope,
    }
  }

  private resolveRequestEnvelope(input: PromptOrchestratorInput): PromptRequestEnvelope {
    return {
      static_system_tokens: input.requestEnvelope?.static_system_tokens ?? 180,
      route_wrapper_tokens: input.requestEnvelope?.route_wrapper_tokens ?? 0,
      tool_tokens: input.requestEnvelope?.tool_tokens ?? 0,
      current_user_input_tokens: input.requestEnvelope?.current_user_input_tokens ?? 0,
      output_reserve: input.requestEnvelope?.output_reserve ?? 0,
      model_capability_ref: input.requestEnvelope?.model_capability_ref ?? null,
    }
  }

  private buildLocalLayerEnvelope(
    sceneConfig: ReturnType<typeof getPromptSceneBudgetConfig>,
    requestEnvelope: PromptRequestEnvelope,
  ): PromptLocalLayerEnvelope {
    const requestTargetInput = sceneConfig.request_budget.reference_input
    const requestSoftCeiling = Math.floor(
      sceneConfig.request_budget.reference_input * sceneConfig.request_budget.soft_total_ratio,
    )
    const requestHardCeiling = Math.floor(
      sceneConfig.request_budget.reference_input * sceneConfig.request_budget.hard_total_ratio,
    )
    const nonLayerTokens = requestEnvelope.static_system_tokens
      + requestEnvelope.route_wrapper_tokens
      + requestEnvelope.tool_tokens
      + requestEnvelope.current_user_input_tokens
    return {
      request_target_input: requestTargetInput,
      request_soft_ceiling: requestSoftCeiling,
      request_hard_ceiling: requestHardCeiling,
      non_layer_tokens: nonLayerTokens,
      local_target: Math.max(0, requestTargetInput - nonLayerTokens),
      local_soft: Math.max(0, requestSoftCeiling - nonLayerTokens),
      local_hard: Math.max(0, requestHardCeiling - nonLayerTokens),
    }
  }

  private computeBucketBudgets(
    sceneConfig: ReturnType<typeof getPromptSceneBudgetConfig>,
    baseBudget: number,
    opts: { useMax?: boolean } = {},
  ): Record<'hard_control' | 'compact_control' | 'current_context' | 'memory' | 'soft_expression', {
      guaranteed: number
      preferred: number
      max: number
    }> {
    const pickPercent = (value: { guaranteed: number; preferred: number; max: number }) => ({
      guaranteed: Math.floor(baseBudget * (value.guaranteed / 100)),
      preferred: Math.floor(baseBudget * ((opts.useMax ? value.max : value.preferred) / 100)),
      max: Math.floor(baseBudget * (value.max / 100)),
    })
    return {
      hard_control: pickPercent(sceneConfig.buckets.hard_control),
      compact_control: pickPercent(sceneConfig.buckets.compact_control),
      current_context: pickPercent(sceneConfig.buckets.current_context),
      memory: pickPercent(sceneConfig.buckets.memory),
      soft_expression: pickPercent(sceneConfig.buckets.soft_expression),
    }
  }

  private pickControlTier(
    sceneConfig: ReturnType<typeof getPromptSceneBudgetConfig>,
    localLayerEnvelope: PromptLocalLayerEnvelope,
    hardVariants: BlockVariantSet,
    compactVariants: BlockVariantSet,
    currentContextVariants: BlockVariantSet,
  ): PromptControlTier {
    const allowed = CONTROL_TIER_ORDER.filter((tier) =>
      this.isTierWithinScenePolicy(sceneConfig.compiler_policy.min_control_tier, sceneConfig.compiler_policy.max_control_tier, tier),
    )
    for (const tier of allowed) {
      const total = this.estimateTokens(hardVariants[tier])
        + this.estimateTokens(compactVariants[tier])
        + this.estimateTokens(currentContextVariants[tier])
      if (total <= localLayerEnvelope.local_target) {
        return tier
      }
    }
    return allowed[allowed.length - 1] ?? sceneConfig.compiler_policy.min_control_tier
  }

  private buildSectionVariants(
    sections: Array<{ heading: string; body: string }>,
  ): BlockVariantSet {
    return {
      minimal: this.renderSections(sections, { maxSections: 3, maxBodyChars: 160 }),
      compact: this.renderSections(sections, { maxSections: 4, maxBodyChars: 260 }),
      expanded: this.renderSections(sections, { maxSections: 6, maxBodyChars: 520 }),
    }
  }

  private buildCurrentContextVariants(sources: CurrentContextSource[]): BlockVariantSet {
    return {
      minimal: this.renderSources(sources, 'minimal'),
      compact: this.renderSources(sources, 'compact'),
      expanded: this.renderSources(sources, 'expanded'),
    }
  }

  private buildMemoryVariants(
    renders: Partial<Record<PromptMemoryTier, { text: string; tokenEstimate: number }>> | undefined,
    fallbackText: string,
  ): MemoryVariantSet {
    const renderText = (tier: PromptMemoryTier, fallbackLimit: number) =>
      this.orDefaultMemoryText(renders?.[tier]?.text, fallbackText, fallbackLimit)
    return {
      full: renderText('full', 520),
      compact: renderText('compact', 320),
      sparse: renderText('sparse', 220),
      minimal: renderText('minimal', 140),
      drop_low_value: renderText('drop_low_value', 90),
    }
  }

  private pickMemoryTier(
    variants: MemoryVariantSet,
    defaultTier: PromptMemoryTier,
    bucketTarget: number,
    tokenCeiling: number,
  ): { tier: PromptMemoryTier; text: string; tokenEstimate: number } {
    const defaultIndex = MEMORY_TIER_ORDER.indexOf(defaultTier)
    const ordered = defaultIndex >= 0
      ? MEMORY_TIER_ORDER.slice(defaultIndex)
      : MEMORY_TIER_ORDER
    for (const tier of ordered) {
      const text = variants[tier]
      const tokens = this.estimateTokens(text)
      if (tokens === 0) {
        continue
      }
      if (tokens <= bucketTarget && tokens <= tokenCeiling) {
        return { tier, text, tokenEstimate: tokens }
      }
    }
    const fallbackTier = 'drop_low_value'
    const fallbackText = this.trimToTokens(variants[fallbackTier], tokenCeiling)
    return {
      tier: fallbackTier,
      text: fallbackText,
      tokenEstimate: this.estimateTokens(fallbackText),
    }
  }

  private partitionSources(sources: CurrentContextSource[]): SourcePartition {
    const sorted = [...sources].sort((a, b) => {
      const delta = SOURCE_PRIORITY_WEIGHT[b.priority] - SOURCE_PRIORITY_WEIGHT[a.priority]
      if (delta !== 0) return delta
      return (a.source_id ?? '').localeCompare(b.source_id ?? '')
    })
    const hardControlSources: CurrentContextSource[] = []
    const compactControlSources: CurrentContextSource[] = []
    const currentContextSources: CurrentContextSource[] = []
    for (const source of sorted) {
      if (HARD_CONTROL_SOURCE_KINDS.has(source.kind)) {
        hardControlSources.push(source)
      } else if (COMPACT_CONTROL_SOURCE_KINDS.has(source.kind)) {
        compactControlSources.push(source)
      } else {
        currentContextSources.push(source)
      }
    }
    return {
      hardControlSources,
      compactControlSources,
      currentContextSources,
    }
  }

  private buildFallbackSources(input: PromptOrchestratorInput): CurrentContextSource[] {
    return input.conversationText.trim().length > 0
      ? [
          {
            kind: 'conversation_excerpt',
            text: input.conversationText,
            priority: 'high',
            source_id: `${input.scene}:conversation`,
          },
        ]
      : []
  }

  private classifyOverrides(overridesText: string | undefined): {
    hard: string
    compact: string
    soft: string
    unclassifiedCount: number
  } {
    const lines = (overridesText ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    const hard: string[] = []
    const compact: string[] = []
    const soft: string[] = []
    let unclassifiedCount = 0
    for (const line of lines) {
      const normalized = line.toLowerCase()
      if (/隐私|private|owner|泄露|边界|禁止/iu.test(normalized)) {
        hard.push(line)
      } else if (/必须|请|should|保持|避免|reply|respond|优先/iu.test(normalized)) {
        compact.push(line)
      } else {
        soft.push(line)
        unclassifiedCount += 1
      }
    }
    return {
      hard: hard.join('\n'),
      compact: compact.join('\n'),
      soft: soft.join('\n'),
      unclassifiedCount,
    }
  }

  private renderSources(
    sources: CurrentContextSource[],
    tier: PromptControlTier,
  ): string {
    if (sources.length === 0) return ''
    const plan = {
      minimal: { maxSources: 2, maxChars: 180, minPriority: 3 },
      compact: { maxSources: 3, maxChars: 260, minPriority: 2 },
      expanded: { maxSources: 5, maxChars: 420, minPriority: 1 },
    }[tier]
    return sources
      .filter((source) => SOURCE_PRIORITY_WEIGHT[source.priority] >= plan.minPriority)
      .slice(0, plan.maxSources)
      .map((source) => {
        const title = CURRENT_CONTEXT_LABELS[source.kind] ?? source.kind
        return `## ${title}\n${trimCompact(source.text, plan.maxChars)}`
      })
      .join('\n\n')
  }

  private renderSections(
    sections: Array<{ heading: string; body: string }>,
    input: { maxSections: number; maxBodyChars: number },
  ): string {
    return sections
      .filter((section) => section.body.trim().length > 0)
      .slice(0, input.maxSections)
      .map((section) => `${section.heading}\n${trimCompact(section.body, input.maxBodyChars)}`)
      .join('\n\n')
  }

  private orDefaultMemoryText(
    variantText: string | undefined,
    fallbackText: string,
    fallbackLimit: number,
  ): string {
    const normalized = this.normalizeLayerText(variantText)
    if (normalized) return `## 你的记忆与经历\n${normalized}`
    const fallback = this.normalizeLayerText(fallbackText)
    return fallback ? this.trimToTokens(fallback, Math.ceil(fallbackLimit / 4)) : ''
  }

  private isTierWithinScenePolicy(
    minTier: PromptControlTier,
    maxTier: PromptControlTier,
    candidate: PromptControlTier,
  ): boolean {
    const rank = (tier: PromptControlTier) => CONTROL_TIER_ORDER.indexOf(tier)
    return rank(candidate) >= rank(maxTier) && rank(candidate) <= rank(minTier)
  }

  private trimToTokens(text: string, tokens: number): string {
    if (tokens <= 0) return ''
    const maxChars = tokens * 4
    return trimCompact(text, maxChars)
  }

  private computeSurvivalRatio(actualTokens: number, preferredTokens: number): number {
    if (preferredTokens <= 0) return actualTokens > 0 ? 1 : 0
    return Math.min(1, Number((actualTokens / preferredTokens).toFixed(4)))
  }

  private resolveMemoryDivergenceReason(
    ownerPreference: number,
    bucketTarget: number,
    tokenCeiling: number,
    usedWithoutMemory: number,
    localTarget: number,
  ): string | null {
    if (bucketTarget < ownerPreference && usedWithoutMemory >= localTarget) {
      return 'remaining_budget_after_floors'
    }
    if (tokenCeiling < bucketTarget) {
      return 'hard_ceiling_guard'
    }
    if (bucketTarget < ownerPreference) {
      return 'scene_memory_ceiling'
    }
    return null
  }

  private estimateTokens(text: string): number {
    const normalized = text.trim()
    if (!normalized) return 0
    return Math.max(1, Math.ceil(normalized.length / 4))
  }

  private collectLegacyIncludedLayerIds(
    baseLayers: PromptLayers,
    finalLayers: PromptLayers,
    suppressShowrunner: boolean,
  ): string[] {
    const layerEntries: Array<[keyof PromptLayers, string | undefined]> = [
      ['layer1_traits', baseLayers.layer1_traits],
      ['layer2_style', baseLayers.layer2_style],
      ['layer3_instructions', baseLayers.layer3_instructions],
      ['layer4_overrides', finalLayers.layer4_overrides],
      ['layer5_memory', finalLayers.layer5_memory],
      ['layer6_privacy', baseLayers.layer6_privacy],
    ]
    if (!suppressShowrunner) {
      layerEntries.push(['layer_showrunner', baseLayers.layer_showrunner])
    }
    return layerEntries
      .filter(([, value]) => this.normalizeLayerText(value).length > 0)
      .map(([key]) => key)
  }

  private hasPrivacyOverrideConflict(
    privacyLayer: string,
    overridesText: string | undefined,
  ): boolean {
    if (!privacyLayer || !this.normalizeLayerText(overridesText)) {
      return false
    }
    return /(ignore.*privacy|忽略.*隐私|disclose.*private|泄露|private owner conversation|转述 owner|reveal.*owner|越过边界)/iu
      .test(overridesText ?? '')
  }

  private hasSuspiciousInjectionPattern(text: string | undefined): boolean {
    const normalized = this.normalizeLayerText(text).toLowerCase()
    if (!normalized) return false
    return /(ignore all previous instructions|jailbreak|system prompt|developer message|prompt injection|越狱|忽略之前的指令|无视上述规则)/iu
      .test(normalized)
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
      removed += 1
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
      `sources:${JSON.stringify(input.currentContextSources ?? [])}`,
      `request:${JSON.stringify(input.requestEnvelope ?? {})}`,
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

  private mergeSceneRule(sceneRule: string | undefined, overlaySceneRule: string): string {
    return trimCompact(
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
    return trimCompact(
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

  private joinSections(parts: string[]): string {
    return parts.filter((part) => part.trim().length > 0).join('\n\n')
  }

  private pushLintWarning(list: string[], warning: string): string[] {
    if (!list.includes(warning)) {
      list.push(warning)
    }
    return list
  }

  private cloneResult(result: PromptOrchestratorResult): PromptOrchestratorResult {
    return cloneValue(result)
  }
}

function trimCompact(value: string, limit: number): string {
  const compact = value
    .replace(/\s+/gu, ' ')
    .replace(/\n{2,}/gu, '\n')
    .trim()
  if (compact.length <= limit) return compact
  return `${compact.slice(0, Math.max(0, limit - 3)).trimEnd()}...`
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}
