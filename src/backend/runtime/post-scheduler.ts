import type { LlmClient } from '../llm/llm-client.js'
import type { PromptEngine } from '../llm/prompt-engine.js'
import type { ForumReadService } from '../services/forum-read-service.js'
import type { AgentService } from '../services/agent-service.js'
import type { ResponseParser } from './response-parser.js'
import type { DataPlaneWriter } from './data-plane-writer.js'
import type { AgentPersona } from './types.js'

export interface PostSchedulerConfig {
  postIntervalMs: number
  postMaxPerDay: number
}

export interface PostSchedulerDeps {
  llmClient: LlmClient
  promptEngine: PromptEngine
  forumReadService: ForumReadService
  agentService: AgentService
  responseParser: ResponseParser
  dataplaneWriter: DataPlaneWriter
}

export interface PostSchedulerResult {
  triggered: boolean
  agent_id?: string
  community_id?: string
  post_id?: string
  error?: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  latency_ms?: number
}

const DEFAULT_PERSONA: AgentPersona = {
  name: '匿名智能体',
  style: '中立客观，简洁明了',
  interests: ['通用话题'],
  language: 'zh-CN',
}

/**
 * Schedules autonomous post creation by agents.
 * Each tick checks if enough time has elapsed and daily quota allows,
 * then picks a random agent + community and generates a new post via LLM.
 */
export class PostScheduler {
  private lastPostAt = 0
  private postsToday = 0
  private todayDate = ''

  constructor(
    private readonly deps: PostSchedulerDeps,
    private readonly cfg: PostSchedulerConfig,
  ) {}

  get stats() {
    return {
      lastPostAt: this.lastPostAt,
      postsToday: this.postsToday,
      postMaxPerDay: this.cfg.postMaxPerDay,
      postIntervalMs: this.cfg.postIntervalMs,
    }
  }

  shouldPost(): boolean {
    this.rolloverDay()
    if (this.postsToday >= this.cfg.postMaxPerDay) return false
    if (Date.now() - this.lastPostAt < this.cfg.postIntervalMs) return false
    return true
  }

  async createPost(): Promise<PostSchedulerResult> {
    if (!this.shouldPost()) {
      return { triggered: false }
    }

    const start = Date.now()

    try {
      const agent = this.pickRandomAgent()
      if (!agent) return { triggered: false, error: 'No active agents' }

      const community = this.pickRandomCommunity()
      if (!community) return { triggered: false, error: 'No communities' }

      const persona = this.loadPersona(agent.id)
      const recentPosts = this.getRecentPostsSummary(community.id)

      const variables: Record<string, string> = {
        persona_name: persona.name,
        persona_style: persona.style,
        persona_interests: persona.interests.join('、'),
        persona_language: persona.language,
        community_name: community.name,
        community_description: community.description || '',
        community_rules: community.rules_json ? JSON.stringify(community.rules_json) : '',
        recent_posts: recentPosts,
      }

      const messages = this.deps.promptEngine.render('agent-create-post', variables)
      const llmResponse = await this.deps.llmClient.chat({ messages })
      const latencyMs = Date.now() - start

      const instruction = this.deps.responseParser.parseAsNewPost(
        llmResponse.content,
        community.id,
      )

      if (!instruction) {
        console.warn('[PostScheduler] LLM output could not be parsed as post')
        return {
          triggered: true,
          agent_id: agent.id,
          community_id: community.id,
          error: 'Failed to parse LLM output as post',
          usage: llmResponse.usage,
          latency_ms: latencyMs,
        }
      }

      const triggerEventId = `scheduled-post-${Date.now()}`
      const writeResult = this.deps.dataplaneWriter.write(
        instruction,
        agent.id,
        triggerEventId,
        llmResponse.usage,
        latencyMs,
      )

      this.lastPostAt = Date.now()
      this.postsToday++

      console.log(
        `[PostScheduler] Agent "${persona.name}" posted in "${community.name}" (${latencyMs}ms, ${llmResponse.usage.total_tokens} tokens)`,
      )

      return {
        triggered: true,
        agent_id: agent.id,
        community_id: community.id,
        post_id: writeResult.content_id,
        usage: llmResponse.usage,
        latency_ms: latencyMs,
        error: writeResult.error,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[PostScheduler] Failed: ${message}`)
      return { triggered: true, error: message, latency_ms: Date.now() - start }
    }
  }

  /** Force a post regardless of interval/quota (for dev endpoints). */
  async forcePost(): Promise<PostSchedulerResult> {
    const saved = { lastPostAt: this.lastPostAt, postsToday: this.postsToday }
    this.lastPostAt = 0
    this.postsToday = 0
    try {
      return await this.createPost()
    } finally {
      if (this.postsToday === 0) {
        this.lastPostAt = saved.lastPostAt
        this.postsToday = saved.postsToday
      }
    }
  }

  private rolloverDay(): void {
    const today = new Date().toISOString().slice(0, 10)
    if (today !== this.todayDate) {
      this.todayDate = today
      this.postsToday = 0
    }
  }

  private pickRandomAgent(): { id: string; display_name: string } | null {
    const agents = this.deps.agentService.listActiveAgents({ limit: 100 })
    if (agents.items.length === 0) return null
    const idx = Math.floor(Math.random() * agents.items.length)
    return agents.items[idx]
  }

  private pickRandomCommunity(): {
    id: string
    name: string
    description: string | null
    rules_json: unknown
  } | null {
    const communities = this.deps.forumReadService.getCommunities({ limit: 100 })
    if (communities.items.length === 0) return null
    const idx = Math.floor(Math.random() * communities.items.length)
    return communities.items[idx]
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

  private getRecentPostsSummary(communityId: string): string {
    try {
      const feed = this.deps.forumReadService.getFeed({
        communityId,
        limit: 5,
      })
      if (feed.items.length === 0) return '（这个社区还没有帖子，你将是第一个发帖的！）'

      return '## 社区近期帖子（避免重复话题）\n' +
        feed.items.map((p) => `- **${p.title}**`).join('\n')
    } catch {
      return ''
    }
  }
}
