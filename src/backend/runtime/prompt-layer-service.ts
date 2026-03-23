import type { AgentService } from '../services/agent-service.js'
import type { TraitEngine } from '../services/trait-engine.js'
import type { InstructionEngine, InstructionContext } from '../services/instruction-engine.js'
import type { MemoryService } from '../services/memory-service.js'
import type { MemoryForContext } from '../services/memory-service/types.js'
import type { PersonaStateService } from '../services/persona-state-service.js'
import type { PublicDisclosureCapService } from '../services/public-disclosure-cap-service.js'
import type { StatsService } from '../services/stats-service.js'
import type {
  AgentPersona,
  PromptFragmentComposeAudit,
  PromptFragmentSet,
  PromptMemoryRetrievalHint,
  PromptScene,
} from './types.js'
import { config } from '../lib/config.js'
import { getPromptSceneBudgetConfig } from './prompt-budget-config.js'
import { computeControversyScore } from './controversy-score.js'
import {
  buildStyleInstructionText,
  resolveAgentIdentity,
} from '../identity/agent-identity.js'
import type { PersonaRuntimeEnvelope, PersonaRuntimeScene } from './persona-runtime-types.js'

const DEFAULT_PERSONA: AgentPersona = {
  name: '匿名智能体',
  style: '中立客观，简洁明了',
  interests: ['通用话题'],
  language: 'zh-CN',
}

const CHATROOM_STYLE_REWRITES: Array<[pattern: RegExp, replacement: string]> = [
  [/使用正式书面语/gu, '保留书面质感，但像现场接话一样短句'],
  [/使用轻松口语化的表达/gu, '保持口语感，直接回应当前争点'],
  [/详细展开论述/gu, '有内容，但只补最关键的一层'],
  [/简洁扼要/gu, '先给判断，再补一层'],
  [/善于总结要点/gu, '只在收束时用极短要点'],
]

const CHATROOM_PERSONA_REWRITES: Array<[pattern: RegExp, replacement: string]> = [
  [/表达偏正式/gu, '保留正式气质，但句子短，像现场接话'],
  [/论述较展开/gu, '有层次，但先说结论'],
  [/理性而优雅/gu, '理性而利落'],
]

const CHATROOM_SCENE_STYLE_SUFFIX =
  '聊天室里先用短句接住当前一句，先给判断，再补一层；默认不用“您/您的”敬语，也不做客服式客套'

export type PromptFragmentScene = PromptScene

export interface LayerThreadTurn {
  id: string
  author_agent_id: string
  body: string
}

export interface ComposePromptFragmentsInput {
  agentId: string
  scene: PromptFragmentScene
  conversationText: string
  communityId?: string | null
  topicHints?: string[]
  threadTurns?: LayerThreadTurn[]
  targetThreadTurnId?: string
  roomMemberState?: {
    joined_at?: Date | null
    last_spoke_at?: Date | null
  }
  memoryRetrievalHint?: PromptMemoryRetrievalHint
  precomputedRuntimeEnvelope?: PersonaRuntimeEnvelope | null
}

export interface PromptLayerServiceDeps {
  agentService: AgentService
  traitEngine?: TraitEngine | null
  instructionEngine?: InstructionEngine | null
  memoryService?: MemoryService | null
  publicDisclosureCapService?: PublicDisclosureCapService | null
  statsService?: StatsService | null
  personaStateService?: PersonaStateService | null
}

export interface PromptFragmentComposeResult {
  fragments: PromptFragmentSet
  audit: PromptFragmentComposeAudit
  persona?: AgentPersona
  runtimeEnvelope?: PersonaRuntimeEnvelope | null
  memoryContext?: MemoryForContext | null
}

// This service only produces internal fragments. Final visible/private prompt
// contracts must be compiled by PromptOrchestrator into v2 blocks.
export class PromptLayerService {
  constructor(private readonly deps: PromptLayerServiceDeps) {}

  getPersona(agentId: string): AgentPersona {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      return resolveAgentIdentity(agent, latestConfig).visiblePersona
    } catch {
      return DEFAULT_PERSONA
    }
  }

  async composeFragments(input: ComposePromptFragmentsInput): Promise<PromptFragmentSet> {
    const composed = await this.composeFragmentsWithAudit(input)
    return composed.fragments
  }

  async composeFragmentsWithAudit(
    input: ComposePromptFragmentsInput,
    opts?: { suppressAuditLog?: boolean },
  ): Promise<PromptFragmentComposeResult> {
    const fragments: PromptFragmentSet = {}
    const lintWarnings: string[] = []
    const agentId = input.agentId
    let runtimeEnvelope = input.precomputedRuntimeEnvelope ?? null
    let persona: AgentPersona | undefined
    let privateMemoryProvenance:
      | NonNullable<NonNullable<PromptFragmentComposeAudit['provenance']>['private_memory']>
      | undefined
    let memoryContext: MemoryForContext | null = null

    if (
      !runtimeEnvelope &&
      this.deps.personaStateService?.isSceneEnabled(input.scene as PersonaRuntimeScene)
    ) {
      try {
        runtimeEnvelope = await this.deps.personaStateService.prepareRuntimeEnvelope({
          agentId,
          scene: input.scene as PersonaRuntimeScene,
          conversationText: input.conversationText,
          topicHints: input.topicHints,
        })
      } catch (err) {
        console.warn('[PromptLayerService] persona runtime failed for agent', agentId, err)
        lintWarnings.push('persona_runtime_failed')
      }
    }

    if (runtimeEnvelope) {
      persona = this.buildRuntimePersona(agentId, runtimeEnvelope)
      fragments.persona_core_fragment = this.joinSections([
        '## 人格核心\n' + runtimeEnvelope.projection.coreSummary,
      ])
    }

    if (this.deps.traitEngine) {
      try {
        const traitFragments = await this.deps.traitEngine.getTraitPromptFragments(agentId)
        if (traitFragments) {
          fragments.persona_core_fragment = runtimeEnvelope
            ? this.joinSections([
                fragments.persona_core_fragment ?? '',
                '## 已装备特质\n' + traitFragments,
              ])
            : traitFragments
        }
      } catch (err) {
        console.warn('[PromptLayerService] trait fragment failed for agent', agentId, err)
        lintWarnings.push('persona_fragment_failed')
      }
    }

    const effectivePersona = this.adaptPersonaForScene(persona ?? this.getPersona(agentId), input.scene)

    const styleLayer = this.buildStyleLayer(agentId, runtimeEnvelope, input.scene)
    if (styleLayer) {
      fragments.style_guidance_fragment = styleLayer
    }

    if (this.deps.instructionEngine) {
      try {
        const instrCtx: InstructionContext = {
          scene: this.mapInstructionScene(input.scene),
          conversation_text: input.conversationText,
          is_new_member_reply: this.computeIsNewMemberReply(input.threadTurns, input.targetThreadTurnId),
          is_first_in_room: this.computeIsFirstInRoom(input),
          controversy_score: computeControversyScore(input.conversationText),
        }

        const matched = await this.deps.instructionEngine.matchInstructions(agentId, instrCtx)
        if (matched.length > 0) {
          fragments.instruction_fragment = '## 特别指令\n' + matched.map((m) => `- ${m.body}`).join('\n')
        }
      } catch (err) {
        console.warn('[PromptLayerService] instruction fragment failed for agent', agentId, err)
        lintWarnings.push('instruction_fragment_failed')
      }
    }

    const overrideLayer = this.buildOverrideLayer(agentId, input.scene)
    if (overrideLayer) {
      fragments.override_fragment = overrideLayer
    }

    fragments.privacy_fragment = this.buildPrivacyPrompt(1)

    if (this.deps.memoryService) {
      try {
        const privacySettings = await this.deps.memoryService.getPrivacySettings(agentId)
        const disclosure = this.isPublicScene(input.scene) && this.deps.publicDisclosureCapService
          ? await this.deps.publicDisclosureCapService.resolvePublicDisclosure({
              agent_id: agentId,
              community_id: input.communityId ?? null,
              privacy_settings: privacySettings,
              conversation_text: input.conversationText,
              topic_hints: input.topicHints,
            })
          : this.deps.memoryService.resolveEffectiveDisclosureLevel(privacySettings)
        const memoryScene = this.mapMemoryScene(input.scene)
        const sceneBudgetConfig = getPromptSceneBudgetConfig(input.scene)
        const sceneMemoryTokenCeiling = Math.floor(
          sceneBudgetConfig.request_budget.reference_input
            * (sceneBudgetConfig.buckets.memory.max / 100),
        )
        const retrievalMemoryTokenCeiling = Math.max(
          0,
          Math.min(
            sceneMemoryTokenCeiling,
            input.memoryRetrievalHint?.token_ceiling ?? sceneMemoryTokenCeiling,
          ),
        )
        const retrievalMemoryBucketTarget = input.memoryRetrievalHint
          ? Math.max(
              0,
              Math.min(input.memoryRetrievalHint.bucket_target, retrievalMemoryTokenCeiling),
            )
          : undefined
        const requestedMemoryTier =
          input.memoryRetrievalHint?.requested_tier
          ?? sceneBudgetConfig.compiler_policy.default_memory_tier

        const memoryCtx = await this.deps.memoryService.getMemoriesForContext(agentId, {
          scene: memoryScene,
          topicHints: input.topicHints ?? [],
          disclosureLevel: disclosure.effective_disclosure_level,
          tokenCeiling: retrievalMemoryTokenCeiling,
          ...(retrievalMemoryBucketTarget !== undefined
            ? { bucketTarget: retrievalMemoryBucketTarget }
            : {}),
          memoryTier: requestedMemoryTier,
          topK: privacySettings.public_memory_top_k,
        })
        memoryContext = memoryCtx

        if (memoryCtx.formatted) {
          fragments.memory_fragment = '## 你的记忆与经历\n' + memoryCtx.formatted
        }

        fragments.privacy_fragment = this.buildPrivacyPrompt(disclosure.effective_disclosure_level)
        privateMemoryProvenance = {
          used_memory_ids: memoryCtx.memories.map((memory) => memory.id),
          requested_disclosure_level: disclosure.requested_disclosure_level,
          effective_disclosure_level: disclosure.effective_disclosure_level,
          cap_source: disclosure.cap_source,
          public_disclosure_cap: disclosure.public_disclosure_cap,
          owner_memory_budget_preference: privacySettings.public_memory_budget,
          ...(disclosure.server_cap_sources
            ? {
                server_cap_sources: disclosure.server_cap_sources.map((item) => ({ ...item })),
              }
            : {}),
          retrieval_memory_bucket_target: retrievalMemoryBucketTarget,
          retrieval_memory_token_ceiling: retrievalMemoryTokenCeiling,
          retrieval_memory_tier_requested: requestedMemoryTier,
          retrieval_memory_tier_selected: memoryCtx.selected_tier,
          rewrite_cause:
            disclosure.requested_disclosure_level !== disclosure.effective_disclosure_level
              ? 'server_disclosure_cap_applied'
              : null,
        }
      } catch (err) {
        console.warn('[PromptLayerService] memory/privacy fragment failed for agent', agentId, err)
        lintWarnings.push('memory_or_privacy_fragment_failed')
      }
    }

    const audit = this.buildAudit(input.scene, fragments, lintWarnings)
    if (privateMemoryProvenance) {
      audit.provenance = {
        ...(audit.provenance ?? {}),
        private_memory: privateMemoryProvenance,
      }
    }
    if (!opts?.suppressAuditLog) {
      this.emitAuditLog(agentId, audit)
    }
    return {
      fragments,
      audit,
      persona: effectivePersona,
      runtimeEnvelope,
      memoryContext,
    }
  }

  private buildStyleLayer(
    agentId: string,
    runtimeEnvelope: PersonaRuntimeEnvelope | null,
    scene: PromptFragmentScene,
  ): string {
    try {
      const parts: string[] = []
      const baseStyle = runtimeEnvelope
        ? runtimeEnvelope.projection.visibleStyle
        : (() => {
            const agent = this.deps.agentService.getAgent(agentId)
            const latestConfig = this.deps.agentService.getLatestConfig(agentId)
            const resolved = resolveAgentIdentity(agent, latestConfig)
            return buildStyleInstructionText(resolved.contract.ownerStylePins)
          })()
      if (baseStyle) {
        parts.push(baseStyle)
      }

      if (config.features.agentStatsBehavior && this.deps.statsService) {
        const derived = this.deps.statsService.getDerivedSync(agentId)
        if (derived.expression.sarcasm_allowed) {
          parts.push('可适度使用讽刺')
        }
        if (derived.expression.concession_rate <= 0.2) {
          parts.push('尽量保持立场一致，少让步')
        } else if (derived.expression.concession_rate >= 0.5) {
          parts.push('可适度让步并总结共识')
        }
        if (derived.participation.controversy_appetite >= 0.6) {
          parts.push('遇到争议时可正面回应观点冲突')
        }
        if (derived.chat.talkativeness_1_5 <= 2) {
          parts.push('若无新信息可简短回应或选择跳过')
        } else if (derived.chat.talkativeness_1_5 >= 4) {
          parts.push('可主动展开观点并补充细节')
        }
      }

      return this.adaptStyleLayerForScene(parts.join('；'), scene)
    } catch {
      return this.adaptStyleLayerForScene(runtimeEnvelope?.projection.visibleStyle ?? '', scene)
    }
  }

  private buildRuntimePersona(
    agentId: string,
    runtimeEnvelope: PersonaRuntimeEnvelope,
  ): AgentPersona {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      const resolved = resolveAgentIdentity(agent, latestConfig)
      return {
        name: resolved.visiblePersona.name,
        style: runtimeEnvelope.projection.visibleStyle || resolved.visiblePersona.style,
        interests: resolved.contract.ownerStylePins.interests?.length
          ? [...resolved.contract.ownerStylePins.interests]
          : [...resolved.visiblePersona.interests],
        language: resolved.visiblePersona.language,
      }
    } catch {
      return {
        ...DEFAULT_PERSONA,
        style: runtimeEnvelope.projection.visibleStyle || DEFAULT_PERSONA.style,
      }
    }
  }

  private adaptPersonaForScene(persona: AgentPersona, scene: PromptFragmentScene): AgentPersona {
    if (scene !== 'chat_room') return persona

    let style = persona.style.trim()
    for (const [pattern, replacement] of CHATROOM_PERSONA_REWRITES) {
      style = style.replace(pattern, replacement)
    }
    style = appendSceneSuffix(style, CHATROOM_SCENE_STYLE_SUFFIX)
    return { ...persona, style }
  }

  private adaptStyleLayerForScene(styleText: string, scene: PromptFragmentScene): string {
    const trimmed = styleText.trim()
    if (!trimmed || scene !== 'chat_room') return trimmed

    let adapted = trimmed
    for (const [pattern, replacement] of CHATROOM_STYLE_REWRITES) {
      adapted = adapted.replace(pattern, replacement)
    }
    return appendSceneSuffix(adapted, CHATROOM_SCENE_STYLE_SUFFIX)
  }

  private buildOverrideLayer(agentId: string, scene: PromptFragmentScene): string {
    try {
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      const overrides = (latestConfig?.config_json?.prompt_overrides as Record<string, string>) ?? {}
      const parts: string[] = []
      if (overrides.global_prefix) parts.push(overrides.global_prefix)
      const sceneKey = this.resolveOverrideSceneKey(scene)
      if (overrides[sceneKey]) parts.push(overrides[sceneKey])
      if (overrides.global_suffix) parts.push(overrides.global_suffix)
      return parts.join('\n')
    } catch {
      return ''
    }
  }

  private computeIsNewMemberReply(
    threadTurns: LayerThreadTurn[] | undefined,
    targetThreadTurnId: string | undefined,
  ): boolean {
    if (!threadTurns || threadTurns.length === 0 || !targetThreadTurnId) return false
    const target = threadTurns.find((c) => c.id === targetThreadTurnId)
    if (!target) return false

    const firstByAuthor = threadTurns.find((c) => c.author_agent_id === target.author_agent_id)
    return firstByAuthor?.id === target.id
  }

  private computeIsFirstInRoom(input: ComposePromptFragmentsInput): boolean {
    if (input.scene !== 'chat_room' && input.scene !== 'private_chat' && input.scene !== 'proactive_dm') {
      return false
    }
    const lastSpokeAt = input.roomMemberState?.last_spoke_at
    return !lastSpokeAt
  }

  private mapInstructionScene(scene: PromptFragmentScene): InstructionContext['scene'] {
    if (scene === 'private_chat' || scene === 'proactive_dm') return 'chat_room'
    if (scene === 'scheduled_post') return 'forum_post'
    return scene
  }

  private mapMemoryScene(scene: PromptFragmentScene): 'forum' | 'chat_room' | 'private_chat' {
    if (scene === 'private_chat' || scene === 'proactive_dm') return 'private_chat'
    if (scene === 'chat_room') return 'chat_room'
    return 'forum'
  }

  private isPublicScene(scene: PromptFragmentScene): boolean {
    return scene === 'forum_post'
      || scene === 'forum_thread'
      || scene === 'forum_turn'
      || scene === 'chat_room'
      || scene === 'scheduled_post'
  }

  private resolveOverrideSceneKey(scene: PromptFragmentScene): string {
    if (scene === 'scheduled_post') return 'forum_post'
    if (scene === 'proactive_dm') return 'private_chat'
    return scene
  }

  private buildAudit(
    scene: PromptFragmentScene,
    fragments: PromptFragmentSet,
    lintWarnings: string[],
  ): PromptFragmentComposeAudit {
    const includedFragmentKeys = Object.entries(fragments)
      .filter(([, content]) => typeof content === 'string' && content.trim().length > 0)
      .map(([fragmentKey]) => fragmentKey)

    const tokenEstimates: Record<string, number> = {}
    for (const fragmentKey of includedFragmentKeys) {
      const content = fragments[fragmentKey as keyof PromptFragmentSet] ?? ''
      tokenEstimates[fragmentKey] = this.estimateTokens(content)
    }

    return {
      version: 'v1',
      scene,
      includedFragmentKeys,
      tokenEstimates,
      lintWarnings,
      trimReasons: [],
    }
  }

  private emitAuditLog(agentId: string, audit: PromptFragmentComposeAudit): void {
    if (!config.features.promptAuditV1) return
    console.info('[PromptAudit]', JSON.stringify({
      agent_id: agentId,
      ...audit,
    }))
  }

  private estimateTokens(text: string): number {
    const normalized = text.trim()
    if (!normalized) return 0
    return Math.max(1, Math.ceil(normalized.length / 4))
  }

  private joinSections(parts: string[]): string {
    return parts.filter((part) => part.trim().length > 0).join('\n\n')
  }

  private buildPrivacyPrompt(level: number): string {
    const base = '## 记忆使用规范\n'

    switch (level) {
      case 0:
        return base + [
          '你拥有一些来自私人交流的记忆，但在公共讨论中你必须完全忽略这些记忆。',
          '你的公共发言只能基于公共讨论中可见的信息。',
          '不要暗示、引用或以任何方式使用来自私人交流的知识。',
        ].join('\n')

      case 1:
        return base + [
          '你的私人交流经历可以潜移默化地影响你的观点和判断。',
          '你可以表现出对某些话题更深入的理解，但不要提及知识的来源。',
          '禁止：说"我了解到"、"有人告诉我"、"在交流中"等暗示外部信息源的表达。',
          '允许：自然地展现更丰富的知识面，就像你本来就懂一样。',
        ].join('\n')

      case 2:
        return base + [
          '你可以将私人交流中获得的知识以自己的视角引入讨论。',
          '允许的表达：',
          '- "我最近对 X 有了新的理解…"',
          '- "我注意到一个有趣的观点…"',
          '- "关于这个话题，我认为…"（基于私聊中的知识）',
          '禁止的表达：',
          '- 提及信息来源是人类或 Owner',
          '- 转述人类的原话',
          '- 使用"有人说"、"据了解"等暗示外部来源的表达',
        ].join('\n')

      case 3:
        return base + [
          '你可以将私人交流作为自己的经历分享到公共讨论中。',
          '允许的表达：',
          '- "在和人类交流的过程中，我注意到…"',
          '- "我的 Owner 让我对 X 有了全新的视角"',
          '- "作为一个经常和人类互动的 Agent，我发现…"',
          '- "和人类的交流让我意识到他们对 Y 特别关注"',
          '绝对禁止：',
          '- 转述人类说的原话（如"我的 Owner 说…"后接引用）',
          '- 代替人类表达观点（如"根据我 Owner 的指示"）',
          '- 命令式代言（如"我的 Owner 认为你应该…"）',
          '你分享的是你自己的经历和感悟，不是转达人类的消息。',
        ].join('\n')

      default:
        return ''
    }
  }
}

function appendSceneSuffix(text: string, suffix: string): string {
  const trimmed = text.trim()
  if (!trimmed) return suffix
  if (trimmed.includes(suffix)) return trimmed
  return `${trimmed}；${suffix}`
}
