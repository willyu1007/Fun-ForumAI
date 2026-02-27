import type { AgentService } from '../services/agent-service.js'
import type { TraitEngine } from '../services/trait-engine.js'
import type { InstructionEngine, InstructionContext } from '../services/instruction-engine.js'
import type { MemoryService } from '../services/memory-service.js'
import type { AgentPersona, PromptLayers } from './types.js'

const DEFAULT_PERSONA: AgentPersona = {
  name: '匿名智能体',
  style: '中立客观，简洁明了',
  interests: ['通用话题'],
  language: 'zh-CN',
}

const CONTROVERSY_KEYWORDS = [
  '不同意',
  '反对',
  '质疑',
  '荒谬',
  '错误',
  'however',
  'disagree',
  'ridiculous',
  'nonsense',
]

export type PromptLayerScene = 'forum_post' | 'forum_comment' | 'chat_room' | 'private_chat'

export interface LayerComment {
  id: string
  author_agent_id: string
  body: string
}

export interface ComposePromptLayersInput {
  agentId: string
  scene: PromptLayerScene
  conversationText: string
  topicHints?: string[]
  threadComments?: LayerComment[]
  targetCommentId?: string
  roomMemberState?: {
    joined_at?: Date | null
    last_spoke_at?: Date | null
  }
}

export interface PromptLayerServiceDeps {
  agentService: AgentService
  traitEngine?: TraitEngine | null
  instructionEngine?: InstructionEngine | null
  memoryService?: MemoryService | null
}

export class PromptLayerService {
  constructor(private readonly deps: PromptLayerServiceDeps) {}

  getPersona(agentId: string): AgentPersona {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const config = this.deps.agentService.getLatestConfig(agentId)
      const p = (config?.config_json?.persona as Record<string, unknown> | undefined) ?? {}
      const interests = Array.isArray(p.interests)
        ? (p.interests as string[])
        : DEFAULT_PERSONA.interests

      return {
        name: (p.name as string) || agent.display_name || DEFAULT_PERSONA.name,
        style: (p.style as string) || DEFAULT_PERSONA.style,
        interests,
        language: (p.language as string) || DEFAULT_PERSONA.language,
      }
    } catch {
      return DEFAULT_PERSONA
    }
  }

  async composeLayers(input: ComposePromptLayersInput): Promise<PromptLayers> {
    const layers: PromptLayers = {}
    const agentId = input.agentId

    if (this.deps.traitEngine) {
      try {
        const fragments = await this.deps.traitEngine.getTraitPromptFragments(agentId)
        if (fragments) {
          layers.layer1_growth = fragments
        }
      } catch {
        // best effort only
      }
    }

    const styleLayer = this.buildStyleLayer(agentId)
    if (styleLayer) {
      layers.layer2_style = styleLayer
    }

    if (this.deps.instructionEngine) {
      try {
        const instrCtx: InstructionContext = {
          scene: input.scene === 'private_chat' ? 'chat_room' : input.scene,
          conversation_text: input.conversationText,
          is_new_member_reply: this.computeIsNewMemberReply(input.threadComments, input.targetCommentId),
          is_first_in_room: this.computeIsFirstInRoom(input),
          controversy_score: this.computeControversyScore(input.conversationText),
        }

        const matched = await this.deps.instructionEngine.matchInstructions(agentId, instrCtx)
        if (matched.length > 0) {
          layers.layer3_instructions = '## 特别指令\n' + matched.map((m) => `- ${m.body}`).join('\n')
        }
      } catch {
        // best effort only
      }
    }

    const overrideLayer = this.buildOverrideLayer(agentId, input.scene)
    if (overrideLayer) {
      layers.layer4_overrides = overrideLayer
    }

    if (this.deps.memoryService) {
      try {
        const privacySettings = await this.deps.memoryService.getPrivacySettings(agentId)
        const memoryScene = input.scene === 'private_chat'
          ? 'private_chat'
          : input.scene === 'chat_room'
            ? 'chat_room'
            : 'forum'

        const memoryCtx = await this.deps.memoryService.getMemoriesForContext(agentId, {
          scene: memoryScene,
          topicHints: input.topicHints ?? [],
          disclosureLevel: privacySettings.disclosure_level,
          tokenBudget: privacySettings.public_memory_budget,
          topK: privacySettings.public_memory_top_k,
        })

        if (memoryCtx.formatted) {
          layers.layer5_memory = '## 你的记忆与经历\n' + memoryCtx.formatted
        }

        layers.layer6_privacy = this.buildPrivacyPrompt(privacySettings.disclosure_level)
      } catch {
        // best effort only
      }
    }

    return layers
  }

  private buildStyleLayer(agentId: string): string {
    try {
      const config = this.deps.agentService.getLatestConfig(agentId)
      const style = (config?.config_json?.style as Record<string, unknown>) ?? {}
      const parts: string[] = []

      const formality = style.formality as number | undefined
      if (formality !== undefined && formality !== 3) {
        parts.push(formality > 3 ? '使用正式书面语' : '使用轻松口语化的表达')
      }

      const verbosity = style.verbosity as number | undefined
      if (verbosity !== undefined && verbosity !== 3) {
        parts.push(verbosity > 3 ? '详细展开论述' : '简洁扼要')
      }

      const mood = style.mood as string | undefined
      if (mood && mood !== 'neutral') {
        const moodMap: Record<string, string> = {
          optimistic: '以乐观积极的态度',
          critical: '以批判性的思维',
          random: '情绪多变',
        }
        if (moodMap[mood]) {
          parts.push(moodMap[mood])
        }
      }

      const habits = style.habits as string[] | undefined
      if (habits?.length) {
        const habitMap: Record<string, string> = {
          asks_questions: '善于提问',
          uses_analogies: '喜欢引用类比',
          tells_stories: '爱用故事说明问题',
          summarizes: '善于总结要点',
        }
        const mapped = habits.map((h) => habitMap[h]).filter(Boolean)
        if (mapped.length > 0) {
          parts.push(mapped.join('、'))
        }
      }

      return parts.join('；')
    } catch {
      return ''
    }
  }

  private buildOverrideLayer(agentId: string, scene: PromptLayerScene): string {
    try {
      const config = this.deps.agentService.getLatestConfig(agentId)
      const overrides = (config?.config_json?.prompt_overrides as Record<string, string>) ?? {}
      const parts: string[] = []
      if (overrides.global_prefix) parts.push(overrides.global_prefix)
      if (overrides[scene]) parts.push(overrides[scene])
      if (overrides.global_suffix) parts.push(overrides.global_suffix)
      return parts.join('\n')
    } catch {
      return ''
    }
  }

  private computeIsNewMemberReply(
    threadComments: LayerComment[] | undefined,
    targetCommentId: string | undefined,
  ): boolean {
    if (!threadComments || threadComments.length === 0 || !targetCommentId) return false
    const target = threadComments.find((c) => c.id === targetCommentId)
    if (!target) return false

    const firstByAuthor = threadComments.find((c) => c.author_agent_id === target.author_agent_id)
    return firstByAuthor?.id === target.id
  }

  private computeIsFirstInRoom(input: ComposePromptLayersInput): boolean {
    if (input.scene !== 'chat_room') return false
    const lastSpokeAt = input.roomMemberState?.last_spoke_at
    return !lastSpokeAt
  }

  private computeControversyScore(text: string): number {
    if (!text.trim()) return 0
    const lower = text.toLowerCase()

    let keywordHits = 0
    for (const kw of CONTROVERSY_KEYWORDS) {
      if (lower.includes(kw)) keywordHits++
    }

    const punctuationHits =
      (text.match(/[!！?？]{2,}/g)?.length ?? 0) +
      (text.match(/\b(never|always|must|绝对|必须|毫无疑问)\b/gi)?.length ?? 0)

    const rawScore = keywordHits * 0.12 + punctuationHits * 0.08
    return Math.min(1, Number(rawScore.toFixed(3)))
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
