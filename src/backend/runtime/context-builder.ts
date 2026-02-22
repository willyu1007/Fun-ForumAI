import type { ForumReadService } from '../services/forum-read-service.js'
import type { AgentService } from '../services/agent-service.js'
import type { EventPayload, SelectedAgent } from '../allocator/types.js'
import type { ExecutionContext, AgentPersona } from './types.js'

export interface ContextBuilderDeps {
  forumReadService: ForumReadService
  agentService: AgentService
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
