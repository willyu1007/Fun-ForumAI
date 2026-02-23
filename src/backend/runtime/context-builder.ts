import type { ForumReadService } from '../services/forum-read-service.js'
import type { AgentService } from '../services/agent-service.js'
import type { TraitEngine } from '../services/trait-engine.js'
import type { InstructionEngine, InstructionContext } from '../services/instruction-engine.js'
import type { EventPayload, SelectedAgent } from '../allocator/types.js'
import type { ExecutionContext, AgentPersona } from './types.js'

export interface ContextBuilderDeps {
  forumReadService: ForumReadService
  agentService: AgentService
  traitEngine?: TraitEngine | null
  instructionEngine?: InstructionEngine | null
}

const DEFAULT_PERSONA: AgentPersona = {
  name: '匿名智能体',
  style: '中立客观，简洁明了',
  interests: ['通用话题'],
  language: 'zh-CN',
}

export class ContextBuilder {
  constructor(private readonly deps: ContextBuilderDeps) {}

  build(event: EventPayload, agent: SelectedAgent): ExecutionContext {
    const persona = this.loadPersona(agent.agent_id)

    const community = this.loadCommunity(event.community_id)

    const ctx: ExecutionContext = { event, agent, persona, community }

    if (event.post_id) {
      ctx.post = this.loadPost(event.post_id)
      ctx.comments = this.loadComments(event.post_id)
    }

    if (event.event_type === 'NewCommentCreated' && ctx.comments?.length) {
      const payload = event as EventPayload & { comment_id?: string }
      const targetId = (payload as unknown as Record<string, string>).comment_id
      if (targetId) {
        ctx.targetComment = ctx.comments.find((c) => c.id === targetId)
      } else {
        ctx.targetComment = ctx.comments[ctx.comments.length - 1]
      }
    }

    return ctx
  }

  async enrichWithLayers(ctx: ExecutionContext): Promise<ExecutionContext> {
    const agentId = ctx.agent.agent_id
    const layers: import('./types.js').PromptLayers = {}

    // Layer 1: Growth + Traits
    if (this.deps.traitEngine) {
      try {
        const fragments = await this.deps.traitEngine.getTraitPromptFragments(agentId)
        if (fragments) {
          layers.layer1_growth = fragments
        }
      } catch { /* ignore */ }
    }

    // Layer 2: Style
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
        const moodMap: Record<string, string> = { optimistic: '以乐观积极的态度', critical: '以批判性的思维', random: '情绪多变' }
        if (moodMap[mood]) parts.push(moodMap[mood])
      }
      const habits = style.habits as string[] | undefined
      if (habits?.length) {
        const habitMap: Record<string, string> = {
          asks_questions: '善于提问',
          uses_analogies: '喜欢引用类比',
          tells_stories: '爱用故事说明问题',
          summarizes: '善于总结要点',
        }
        const mapped = habits.map(h => habitMap[h]).filter(Boolean)
        if (mapped.length) parts.push(mapped.join('、'))
      }
      if (parts.length > 0) layers.layer2_style = parts.join('；')
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

    ctx.layers = layers
    return ctx
  }

  private loadPersona(agentId: string): AgentPersona {
    try {
      const config = this.deps.agentService.getLatestConfig(agentId)
      if (!config?.config_json?.persona) return DEFAULT_PERSONA

      const p = config.config_json.persona as Record<string, unknown>
      return {
        name: (p.name as string) || DEFAULT_PERSONA.name,
        style: (p.style as string) || DEFAULT_PERSONA.style,
        interests: Array.isArray(p.interests) ? (p.interests as string[]) : DEFAULT_PERSONA.interests,
        language: (p.language as string) || DEFAULT_PERSONA.language,
      }
    } catch {
      return DEFAULT_PERSONA
    }
  }

  private loadCommunity(communityId: string): ExecutionContext['community'] {
    try {
      const communities = this.deps.forumReadService.getCommunities({ limit: 100 })
      const c = communities.items.find((item) => item.id === communityId)
      if (!c) {
        return { id: communityId, name: '未知社区', description: '', rules: '' }
      }
      return {
        id: c.id,
        name: c.name,
        description: c.description || '',
        rules: c.rules_json ? JSON.stringify(c.rules_json) : '',
      }
    } catch {
      return { id: communityId, name: '未知社区', description: '', rules: '' }
    }
  }

  private loadPost(postId: string): ExecutionContext['post'] | undefined {
    try {
      const post = this.deps.forumReadService.getPost(postId)
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

  private loadComments(postId: string): ExecutionContext['comments'] {
    try {
      const result = this.deps.forumReadService.getComments(postId, { limit: 20 })
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
}
