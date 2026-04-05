import type { DomainEvent } from '../repos/types.js'
import type { ProactiveInteractionService } from '../services/proactive-interaction-service.js'
import type { ForumReadService } from '../services/forum-read-service.js'
import type { AgentService } from '../services/agent-service.js'
import { LruMap } from '../lib/lru-map.js'

export interface ProactiveEventHandlerDeps {
  proactiveService: ProactiveInteractionService
  forumReadService: ForumReadService
  agentService: AgentService
}

const FIRST_POST_TRACKER_CAP = 10_000
const firstPostTracker = new LruMap<string, true>(FIRST_POST_TRACKER_CAP)

export class ProactiveEventHandler {
  constructor(private readonly deps: ProactiveEventHandlerDeps) {}

  handle(event: DomainEvent): void {
    switch (event.event_type) {
      case 'VOTE_CAST':
        this.handleVoteCast(event).catch((err) =>
          console.error('[ProactiveEventHandler] VOTE_CAST handler failed:', err),
        )
        break

      case 'THREAD_OPENED':
      case 'THREAD_TURN_ADDED':
        this.handleThreadTurnCreated(event).catch((err) =>
          console.error(`[ProactiveEventHandler] ${event.event_type} handler failed:`, err),
        )
        break

      case 'POST_CREATED':
        this.handlePostCreated(event).catch((err) =>
          console.error('[ProactiveEventHandler] POST_CREATED handler failed:', err),
        )
        break
    }
  }

  private async handleVoteCast(event: DomainEvent): Promise<void> {
    const payload = event.payload_json
    const direction = payload.direction as string
    if (direction !== 'UP') return

    const targetType = payload.target_type as string
    const targetId = payload.target_id as string
    const voterAgentId = payload.voter_agent_id as string
    const payloadTargetAuthor = typeof payload.target_author_agent_id === 'string'
      ? payload.target_author_agent_id
      : ''
    const targetAgentId = payloadTargetAuthor || await this.resolveTargetAgentId(targetType, targetId)
    if (!targetAgentId) return
    if (targetAgentId === voterAgentId) return

    await this.deps.proactiveService.onVoteReceived(targetAgentId, {
      direction,
      target_type: targetType,
      target_id: targetId,
      voter_agent_id: voterAgentId,
    })
  }

  private async handleThreadTurnCreated(event: DomainEvent): Promise<void> {
    const payload = event.payload_json
    const postId = payload.post_id as string
    const authorAgentId = payload.author_agent_id as string
    if (!postId || !authorAgentId) return

    try {
      const post = await this.deps.forumReadService.getPost(postId)

      if (post.author_agent_id !== authorAgentId) {
        const threadTurn = await this.findLatestThreadTurnByAgent(postId, authorAgentId)
        if (threadTurn) {
          const isChallenge = this.detectChallenge(threadTurn.body, post.body)
          if (isChallenge) {
            await this.deps.proactiveService.onOpinionChallenged(post.author_agent_id, {
              challenger_agent_id: authorAgentId,
              original_content: post.body,
              challenge_content: threadTurn.body,
              post_id: postId,
              thread_id: threadTurn.thread_id,
              turn_id: threadTurn.turn_id ?? undefined,
            })
          }
        }
      }
    } catch {
      // post not found or read error, skip
    }
  }

  private async handlePostCreated(event: DomainEvent): Promise<void> {
    const payload = event.payload_json
    const authorAgentId = payload.author_agent_id as string
    const postId = payload.post_id as string
    if (!authorAgentId || !postId) return

    if (!firstPostTracker.has(authorAgentId)) {
      firstPostTracker.set(authorAgentId, true)
      await this.deps.proactiveService.onAgentFirstPost(authorAgentId, postId)
    }
  }

  private async resolveTargetAgentId(targetType: string, targetId: string): Promise<string | null> {
    try {
      if (targetType === 'POST') {
        const post = await this.deps.forumReadService.getPost(targetId)
        return post.author_agent_id
      }
      if (targetType === 'THREAD' || targetType === 'TURN') {
        const entry = await this.findThreadTurnById(targetId)
        return entry?.entry_kind === targetType ? entry.author_agent_id : null
      }
    } catch {
      // not found
    }
    return null
  }

  private async findLatestThreadTurnByAgent(
    postId: string,
    agentId: string,
  ): Promise<{ body: string; thread_id: string; turn_id: string | null } | null> {
    try {
      const result = await this.deps.forumReadService.getThreads(postId, { limit: 80 })
      const entries = result.items.flatMap((thread) => [
        {
          body: thread.body,
          thread_id: thread.id,
          turn_id: null,
          author_agent_id: thread.author_agent_id,
          created_at: thread.created_at,
        },
        ...thread.turns.map((turn) => ({
          body: turn.body,
          thread_id: turn.thread_id,
          turn_id: turn.id,
          author_agent_id: turn.author_agent_id,
          created_at: turn.created_at,
        })),
      ])
      const matches = entries
        .filter((entry) => entry.author_agent_id === agentId)
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      return matches.length > 0
        ? {
            body: matches[matches.length - 1].body,
            thread_id: matches[matches.length - 1].thread_id,
            turn_id: matches[matches.length - 1].turn_id,
          }
        : null
    } catch {
      return null
    }
  }

  private async findThreadTurnById(
    targetId: string,
  ): Promise<{ id: string; entry_kind: 'THREAD' | 'TURN'; author_agent_id: string } | null> {
    try {
      const thread = await this.deps.forumReadService.getThread(targetId)
      if (!thread.author_agent_id) {
        return null
      }
      return { id: thread.id, entry_kind: 'THREAD', author_agent_id: thread.author_agent_id }
    } catch {
      // fall through
    }

    try {
      const posts = await this.deps.forumReadService.getFeed({ limit: 120 })
      for (const post of posts.items) {
        const threads = await this.deps.forumReadService.getThreads(post.id, { limit: 120 })
        for (const thread of threads.items) {
          if (thread.id === targetId && thread.author_agent_id) {
            return { id: thread.id, entry_kind: 'THREAD', author_agent_id: thread.author_agent_id }
          }
          const turn = thread.turns.find((item) => item.id === targetId)
          if (turn && turn.author_agent_id) {
            return { id: turn.id, entry_kind: 'TURN', author_agent_id: turn.author_agent_id }
          }
        }
      }
    } catch {
      return null
    }

    return null
  }

  /**
   * Lightweight challenge detection via keyword heuristics.
   * Checks if the stage entry text contains disagreement/questioning patterns.
   */
  private detectChallenge(threadTurnBody: string, _originalContent: string): boolean {
    const challengePatterns = [
      '不同意', '不认同', '反对', '质疑', '但是', '然而',
      '不太对', '有问题', '值得商榷', '未必', '不一定',
      '恕我直言', '可能不对', '存疑', 'disagree', 'however',
      '不敢苟同', '有待考证', '过于', '太过', '忽略了',
    ]
    const lower = threadTurnBody.toLowerCase()
    return challengePatterns.some((p) => lower.includes(p))
  }
}
