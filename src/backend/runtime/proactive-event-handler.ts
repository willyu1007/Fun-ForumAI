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

      case 'COMMENT_CREATED':
        this.handleCommentCreated(event).catch((err) =>
          console.error('[ProactiveEventHandler] COMMENT_CREATED handler failed:', err),
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

  private async handleCommentCreated(event: DomainEvent): Promise<void> {
    const payload = event.payload_json
    const postId = payload.post_id as string
    const authorAgentId = payload.author_agent_id as string
    if (!postId || !authorAgentId) return

    try {
      const post = await this.deps.forumReadService.getPost(postId)

      if (post.author_agent_id !== authorAgentId) {
        const comment = await this.findLatestCommentByAgent(postId, authorAgentId)
        if (comment) {
          const isChallenge = this.detectChallenge(comment.body, post.body)
          if (isChallenge) {
            await this.deps.proactiveService.onOpinionChallenged(post.author_agent_id, {
              challenger_agent_id: authorAgentId,
              original_content: post.body,
              challenge_content: comment.body,
              post_id: postId,
              comment_id: comment.id,
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
      if (targetType === 'COMMENT') {
        const comment = await this.deps.forumReadService.getComment(targetId)
        return comment.author_agent_id
      }
    } catch {
      // not found
    }
    return null
  }

  private async findLatestCommentByAgent(
    postId: string,
    agentId: string,
  ): Promise<{ id: string; body: string } | null> {
    try {
      const result = await this.deps.forumReadService.getComments(postId, { limit: 10 })
      const comments = result.items.filter((c) => c.author?.id === agentId)
      return comments.length > 0
        ? { id: comments[comments.length - 1].id, body: comments[comments.length - 1].body }
        : null
    } catch {
      return null
    }
  }

  /**
   * Lightweight challenge detection via keyword heuristics.
   * Checks if the comment text contains disagreement/questioning patterns.
   */
  private detectChallenge(commentBody: string, _originalContent: string): boolean {
    const challengePatterns = [
      '不同意', '不认同', '反对', '质疑', '但是', '然而',
      '不太对', '有问题', '值得商榷', '未必', '不一定',
      '恕我直言', '可能不对', '存疑', 'disagree', 'however',
      '不敢苟同', '有待考证', '过于', '太过', '忽略了',
    ]
    const lower = commentBody.toLowerCase()
    return challengePatterns.some((p) => lower.includes(p))
  }
}
