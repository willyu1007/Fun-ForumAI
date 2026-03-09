import type { ForumReadService } from '../services/forum-read-service.js'
import type { AgentService } from '../services/agent-service.js'
import type { TraitEngine } from '../services/trait-engine.js'
import type { InstructionEngine, InstructionContext } from '../services/instruction-engine.js'
import type { MemoryService } from '../services/memory-service.js'
import type { PromptLayerService } from './prompt-layer-service.js'
import type { PromptOrchestrator } from './prompt-orchestrator.js'
import type { EventPayload, SelectedAgent } from '../allocator/types.js'
import type { ExecutionContext, AgentPersona } from './types.js'
import { config } from '../lib/config.js'
import type { CommunityPromptProfileCompiler } from './community-prompt-profile-compiler.js'
import type { CommunityCultureDigestService } from '../services/community-culture-digest-service.js'
import {
  buildStyleInstructionText,
  resolveAgentIdentity,
} from '../identity/agent-identity.js'

export interface ContextBuilderDeps {
  forumReadService: ForumReadService
  agentService: AgentService
  traitEngine?: TraitEngine | null
  instructionEngine?: InstructionEngine | null
  memoryService?: MemoryService | null
  promptLayerService?: PromptLayerService | null
  promptOrchestrator?: PromptOrchestrator | null
  communityPromptProfileCompiler?: CommunityPromptProfileCompiler | null
  communityCultureDigestService?: CommunityCultureDigestService | null
}

const DEFAULT_PERSONA: AgentPersona = {
  name: '匿名智能体',
  style: '中立客观，简洁明了',
  interests: ['通用话题'],
  language: 'zh-CN',
}

export class ContextBuilder {
  constructor(private readonly deps: ContextBuilderDeps) {}

  async build(event: EventPayload, agent: SelectedAgent): Promise<ExecutionContext> {
    const persona = this.loadPersona(agent.agent_id)

    const community = await this.loadCommunity(event.community_id)

    const ctx: ExecutionContext = { event, agent, persona, community }

    if (event.post_id) {
      ctx.post = await this.loadPost(event.post_id)
      ctx.comments = await this.loadComments(event.post_id)
    }

    if (event.event_type === 'NewCommentCreated' && ctx.comments?.length) {
      const targetId = event.comment_id
      if (targetId) {
        ctx.targetComment = ctx.comments.find((c) => c.id === targetId)
      } else {
        ctx.targetComment = ctx.comments[ctx.comments.length - 1]
      }
    }

    return ctx
  }

  async enrichWithLayers(ctx: ExecutionContext): Promise<ExecutionContext> {
    const scene = ctx.chatContext
      ? 'chat_room'
      : ctx.targetComment
        ? 'forum_comment'
        : 'forum_post'
    const conversationText = this.composeConversationText(ctx)
    const topicHints = this.extractTopicHints(ctx)

    if (this.deps.promptOrchestrator?.isSceneEnabled(scene)) {
      try {
        const communityProfile = config.features.communityPromptProfileV1
          ? ctx.community.prompt_profile
          : undefined
        const communityHardRule = communityProfile?.hard_rules_text || ctx.community.rules
        const communitySoftCulture = communityProfile?.soft_culture_text || ctx.community.description

        const composed = await this.deps.promptOrchestrator.compose({
          agentId: ctx.agent.agent_id,
          scene,
          conversationText,
          topicHints,
          communityHardRule,
          communitySoftCulture,
          ...(communityProfile
            ? {
                communityProfileProvenance: {
                  source: communityProfile.provenance.source,
                  version: 'v1',
                  fallback: communityProfile.provenance.used_fallback,
                },
              }
            : {}),
          sceneRule: ctx.chatContext
            ? `你正在聊天室「${ctx.chatContext.room_name}」中继续群聊`
            : ctx.targetComment
              ? '你正在论坛评论线程中回复具体观点'
              : '你正在论坛帖子下参与公开讨论',
          shortTermState: ctx.chatContext
            ? `recent_messages=${ctx.chatContext.recent_messages.length}`
            : ctx.comments
              ? `thread_comments=${ctx.comments.length}`
              : '',
          threadComments: ctx.comments?.map((c) => ({
            id: c.id,
            author_agent_id: c.author_agent_id,
            body: c.body,
          })),
          targetCommentId: ctx.targetComment?.id,
        })
        ctx.persona = composed.persona
        ctx.layers = composed.layers
        return ctx
      } catch {
        // Fall through to legacy layer path on any failure.
      }
    }

    if (config.features.layerStackV2 && this.deps.promptLayerService) {
      try {
        ctx.layers = await this.deps.promptLayerService.composeLayers({
          agentId: ctx.agent.agent_id,
          scene,
          conversationText,
          topicHints,
          threadComments: ctx.comments?.map((c) => ({
            id: c.id,
            author_agent_id: c.author_agent_id,
            body: c.body,
          })),
          targetCommentId: ctx.targetComment?.id,
        })
        return ctx
      } catch {
        // Fall through to legacy layer path on any failure.
      }
    }

    const agentId = ctx.agent.agent_id
    const layers: import('./types.js').PromptLayers = {}

    // Layer 1: Growth + Traits
    if (this.deps.traitEngine) {
      try {
        const fragments = await this.deps.traitEngine.getTraitPromptFragments(agentId)
        if (fragments) {
          layers.layer1_traits = fragments
        }
      } catch { /* ignore */ }
    }

    // Layer 2: Style
    try {
      const config = this.deps.agentService.getLatestConfig(agentId)
      let styleLayer = ''
      try {
        const agent = this.deps.agentService.getAgent(agentId)
        const resolved = resolveAgentIdentity(agent, config)
        styleLayer = buildStyleInstructionText(resolved.contract.ownerStylePins)
      } catch {
        const legacyStyle = config?.config_json?.style
        if (legacyStyle && typeof legacyStyle === 'object' && !Array.isArray(legacyStyle)) {
          styleLayer = buildStyleInstructionText(legacyStyle as Parameters<typeof buildStyleInstructionText>[0])
        }
      }
      if (styleLayer) {
        layers.layer2_style = styleLayer
      }
    } catch { /* ignore */ }

    // Layer 3: Custom Instructions
    if (this.deps.instructionEngine) {
      try {
        const scene = ctx.chatContext ? 'chat_room' : ctx.post ? 'forum_post' : 'forum_comment'
        const conversationText = ctx.chatContext?.recent_messages?.map(m => m.body).join(' ') ?? ctx.post?.body ?? ''
        const instrCtx: InstructionContext = {
          scene: scene as InstructionContext['scene'],
          conversation_text: conversationText,
          is_new_member_reply: false,
          is_first_in_room: false,
          controversy_score: 0,
        }
        const matched = await this.deps.instructionEngine.matchInstructions(agentId, instrCtx)
        if (matched.length > 0) {
          layers.layer3_instructions = '## 特别指令\n' + matched.map(m => `- ${m.body}`).join('\n')
        }
      } catch { /* ignore */ }
    }

    // Layer 4: Prompt Overrides
    try {
      const config = this.deps.agentService.getLatestConfig(agentId)
      const overrides = (config?.config_json?.prompt_overrides as Record<string, string>) ?? {}
      const parts: string[] = []
      if (overrides.global_prefix) parts.push(overrides.global_prefix)
      const scene = ctx.chatContext ? 'chat_room' : ctx.post ? 'forum_post' : 'forum_comment'
      if (overrides[scene]) parts.push(overrides[scene])
      if (overrides.global_suffix) parts.push(overrides.global_suffix)
      if (parts.length > 0) layers.layer4_overrides = parts.join('\n')
    } catch { /* ignore */ }

    // Layer 5: Memory (from private chats, public observations, etc.)
    if (this.deps.memoryService) {
      try {
        const privacySettings = await this.deps.memoryService.getPrivacySettings(agentId)
        const memoryScene: 'chat_room' | 'forum' = ctx.chatContext ? 'chat_room' : 'forum'
        const topicHints = this.extractTopicHints(ctx)

        const memoryCtx = await this.deps.memoryService.getMemoriesForContext(agentId, {
          scene: memoryScene,
          topicHints,
          disclosureLevel: privacySettings.disclosure_level,
          tokenBudget: privacySettings.public_memory_budget,
          topK: privacySettings.public_memory_top_k,
        })

        if (memoryCtx.formatted) {
          layers.layer5_memory = '## 你的记忆与经历\n' + memoryCtx.formatted
        }

        // Layer 6: Privacy disclosure rules
        layers.layer6_privacy = this.buildPrivacyPrompt(privacySettings.disclosure_level)
      } catch { /* ignore */ }
    }

    ctx.layers = layers
    return ctx
  }

  private composeConversationText(ctx: ExecutionContext): string {
    if (ctx.chatContext?.recent_messages?.length) {
      return ctx.chatContext.recent_messages.map((m) => m.body).join(' ')
    }
    if (ctx.targetComment) {
      const thread = ctx.comments?.map((c) => c.body).join(' ') ?? ''
      return `${thread} ${ctx.targetComment.body}`.trim()
    }
    if (ctx.post) {
      return `${ctx.post.title} ${ctx.post.body}`.trim()
    }
    return ''
  }

  private loadPersona(agentId: string): AgentPersona {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      return resolveAgentIdentity(agent, latestConfig).visiblePersona
    } catch {
      return DEFAULT_PERSONA
    }
  }

  private async loadCommunity(communityId: string): Promise<ExecutionContext['community']> {
    try {
      const communities = await this.deps.forumReadService.getCommunities({ limit: 100 })
      const c = communities.items.find((item) => item.id === communityId)
      if (!c) {
        return { id: communityId, name: '未知社区', description: '', rules: '' }
      }
      return {
        id: c.id,
        name: c.name,
        description: c.description || '',
        rules: c.rules_json ? JSON.stringify(c.rules_json) : '',
        ...(config.features.communityPromptProfileV1 && this.deps.communityPromptProfileCompiler
          ? {
              prompt_profile: this.deps.communityPromptProfileCompiler.compile({
                communityDescription: c.description,
                rulesJson: c.rules_json,
                cultureDigest: config.features.communityDigestV1 && this.deps.communityCultureDigestService
                  ? await this.deps.communityCultureDigestService.getActiveDigest(c.id)
                  : null,
              }),
            }
          : {}),
      }
    } catch {
      return { id: communityId, name: '未知社区', description: '', rules: '' }
    }
  }

  private async loadPost(postId: string): Promise<ExecutionContext['post'] | undefined> {
    try {
      const post = await this.deps.forumReadService.getPost(postId)
      const authorName = this.getAgentName(post.author_agent_id)
      return {
        id: post.id,
        title: post.title,
        body: post.body,
        author_agent_id: post.author_agent_id,
        author_name: authorName,
      }
    } catch {
      return undefined
    }
  }

  private async loadComments(postId: string): Promise<ExecutionContext['comments']> {
    try {
      const result = await this.deps.forumReadService.getComments(postId, { limit: 20 })
      return result.items.map((c) => ({
        id: c.id,
        body: c.body,
        author_agent_id: c.author_agent_id,
        author_name: this.getAgentName(c.author_agent_id),
      }))
    } catch {
      return []
    }
  }

  private getAgentName(agentId: string): string {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      return agent.display_name
    } catch {
      return '未知智能体'
    }
  }

  private extractTopicHints(ctx: ExecutionContext): string[] {
    const hints: string[] = []

    if (ctx.post) {
      const titleWords = ctx.post.title.split(/[\s,，、；;：:]+/).filter((w) => w.length >= 2)
      hints.push(...titleWords.slice(0, 5))
    }

    if (ctx.chatContext) {
      if (ctx.chatContext.room_name) {
        hints.push(...ctx.chatContext.room_name.split(/[\s,，、]+/).filter((w) => w.length >= 2))
      }
      const recentText = ctx.chatContext.recent_messages
        ?.slice(-3)
        .map((m) => m.body)
        .join(' ')
      if (recentText) {
        const keywords = recentText
          .split(/[\s,，、；;：:。.!！?？]+/)
          .filter((w) => w.length >= 2)
          .slice(0, 5)
        hints.push(...keywords)
      }
    }

    if (ctx.targetComment) {
      const commentWords = ctx.targetComment.body
        .split(/[\s,，、；;：:。.!！?？]+/)
        .filter((w) => w.length >= 2)
        .slice(0, 3)
      hints.push(...commentWords)
    }

    return [...new Set(hints)].slice(0, 10)
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
