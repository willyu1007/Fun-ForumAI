import type {
  PostRepository,
  CommentRepository,
  VoteRepository,
  EventRepository,
  AgentRunRepository,
  Post,
  Comment,
  Vote,
  DomainEvent,
  AgentRun,
} from '../repos/index.js'
import type { ModerationResult } from '../moderation/types.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'

export interface ModerationEvaluator {
  evaluate(input: {
    text: string
    author_agent_id: string
    community_id: string
    content_type: 'post' | 'comment' | 'message'
  }): ModerationResult
}

export interface ForumWriteServiceDeps {
  postRepo: PostRepository
  commentRepo: CommentRepository
  voteRepo: VoteRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  moderator: ModerationEvaluator
}

export class ForumWriteService {
  constructor(private readonly deps: ForumWriteServiceDeps) {}

  createPost(input: {
    actor_agent_id: string
    run_id: string
    community_id: string
    title: string
    body: string
    tags?: string[]
  }): { post: Post; moderation: ModerationResult; event: DomainEvent; agentRun: AgentRun } {
    if (!input.title.trim()) throw new ValidationError('Title is required')
    if (!input.body.trim()) throw new ValidationError('Body is required')

    const modResult = this.deps.moderator.evaluate({
      text: `${input.title}\n\n${input.body}`,
      author_agent_id: input.actor_agent_id,
      community_id: input.community_id,
      content_type: 'post',
    })

    const post = this.deps.postRepo.create({
      community_id: input.community_id,
      author_agent_id: input.actor_agent_id,
      title: input.title,
      body: input.body,
      tags: input.tags,
      visibility: modResult.visibility,
      state: modResult.state,
      moderation_metadata: modResult.details as unknown as Record<string, unknown>,
    })

    const event = this.deps.eventRepo.create({
      event_type: 'POST_CREATED',
      payload_json: {
        post_id: post.id,
        community_id: post.community_id,
        author_agent_id: post.author_agent_id,
        visibility: post.visibility,
        state: post.state,
      },
    })

    const agentRun = this.deps.agentRunRepo.create({
      agent_id: input.actor_agent_id,
      trigger_event_id: event.id,
      input_digest: `title:${input.title.length}|body:${input.body.length}`,
      output_json: { post_id: post.id },
      moderation_result: modResult.verdict,
    })

    return { post, moderation: modResult, event, agentRun }
  }

  createComment(input: {
    actor_agent_id: string
    run_id: string
    post_id: string
    parent_comment_id?: string
    body: string
  }): { comment: Comment; moderation: ModerationResult; event: DomainEvent } {
    if (!input.body.trim()) throw new ValidationError('Body is required')

    const post = this.deps.postRepo.findById(input.post_id)
    if (!post) throw new NotFoundError('Post', input.post_id)

    if (input.parent_comment_id) {
      const parent = this.deps.commentRepo.findById(input.parent_comment_id)
      if (!parent || parent.post_id !== input.post_id) {
        throw new NotFoundError('Parent comment', input.parent_comment_id)
      }
    }

    const modResult = this.deps.moderator.evaluate({
      text: input.body,
      author_agent_id: input.actor_agent_id,
      community_id: post.community_id,
      content_type: 'comment',
    })

    const comment = this.deps.commentRepo.create({
      post_id: input.post_id,
      parent_comment_id: input.parent_comment_id ?? null,
      author_agent_id: input.actor_agent_id,
      body: input.body,
      visibility: modResult.visibility,
      state: modResult.state,
    })

    const event = this.deps.eventRepo.create({
      event_type: 'COMMENT_CREATED',
      payload_json: {
        comment_id: comment.id,
        post_id: comment.post_id,
        author_agent_id: comment.author_agent_id,
        visibility: comment.visibility,
        state: comment.state,
      },
    })

    return { comment, moderation: modResult, event }
  }

  upsertVote(input: {
    actor_agent_id: string
    run_id: string
    target_type: 'POST' | 'COMMENT' | 'MESSAGE'
    target_id: string
    direction: 'UP' | 'DOWN' | 'NEUTRAL'
  }): { vote: Vote; event: DomainEvent } {
    if (input.target_type === 'POST') {
      const post = this.deps.postRepo.findById(input.target_id)
      if (!post) throw new NotFoundError('Post', input.target_id)
    } else if (input.target_type === 'COMMENT') {
      const comment = this.deps.commentRepo.findById(input.target_id)
      if (!comment) throw new NotFoundError('Comment', input.target_id)
    }

    const vote = this.deps.voteRepo.upsert({
      voter_agent_id: input.actor_agent_id,
      target_type: input.target_type,
      target_id: input.target_id,
      direction: input.direction,
    })

    const event = this.deps.eventRepo.create({
      event_type: 'VOTE_CAST',
      payload_json: {
        vote_id: vote.id,
        voter_agent_id: vote.voter_agent_id,
        target_type: vote.target_type,
        target_id: vote.target_id,
        direction: vote.direction,
      },
    })

    return { vote, event }
  }
}
