import type { PostRepository } from '../repos/index.js'
import type { HumanVoteRepository } from '../repos/human-vote-repository.js'
import type {
  AudienceRepository,
  ListAudienceMessagesAggregatedOptions,
} from '../repos/audience-repository.js'
import type {
  AudienceMessage,
  AudienceMessageAggregate,
  AudienceMessageAuthor,
} from '../repos/types/audience.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'

export interface AudienceAuthorLookup {
  resolve(userIds: readonly string[]): Promise<Map<string, AudienceMessageAuthor>>
}

export interface AudienceServiceDeps {
  audienceRepo: AudienceRepository
  postRepo: PostRepository
  humanVoteRepo: HumanVoteRepository
  authorLookup?: AudienceAuthorLookup
}

export interface QuotedTurnInput {
  turn_id: string
  excerpt: string
  author_display_name?: string | null
}

export type AudienceThreadSort = 'latest' | 'top'

export class AudienceService {
  constructor(private readonly deps: AudienceServiceDeps) {}

  async getThreadByPost(
    postId: string,
    options?: {
      viewer_user_id?: string | null
      sort?: AudienceThreadSort
    },
  ): Promise<{
    thread: import('../repos/types/audience.js').AudienceThread | null
    messages: AudienceMessageAggregate[]
    sort: AudienceThreadSort
  }> {
    const sort: AudienceThreadSort = options?.sort ?? 'latest'
    const post = await this.deps.postRepo.findById(postId)
    if (!post) throw new NotFoundError('Post', postId)

    const thread = await this.deps.audienceRepo.findThreadByPost(post.id)
    if (!thread) {
      return { thread: null, messages: [], sort }
    }
    const aggregated = await this.listAggregatedMessages(thread.id, {
      viewer_user_id: options?.viewer_user_id ?? null,
    })
    return { thread, messages: sortAggregated(aggregated, sort), sort }
  }

  /**
   * List aggregated messages for a thread with author display info + human vote aggregates.
   * Consolidates author lookups so that PgAudienceRepository and InMemoryAudienceRepository
   * converge on the same projection shape without the service layer caring which one.
   */
  async listAggregatedMessages(
    threadId: string,
    options?: ListAudienceMessagesAggregatedOptions,
  ): Promise<AudienceMessageAggregate[]> {
    const aggregated = await this.deps.audienceRepo.listMessagesWithAggregates(
      threadId,
      options,
    )
    const missingIds = new Set<string>()
    if (this.deps.authorLookup) {
      for (const message of aggregated) {
        if (!message.author.display_name || message.author.display_name.startsWith('用户 ')) {
          missingIds.add(message.author_user_id)
        }
      }
    }
    const authors = this.deps.authorLookup && missingIds.size > 0
      ? await this.deps.authorLookup.resolve(Array.from(missingIds))
      : new Map<string, AudienceMessageAuthor>()
    return aggregated.map((message) => {
      const voteSummary = this.deps.humanVoteRepo.countByTarget('AUDIENCE_MESSAGE', message.id)
      return {
        ...message,
        author: authors.get(message.author_user_id) ?? message.author,
        human_vote_up: voteSummary.up,
        human_vote_down: voteSummary.down,
        human_vote_score: voteSummary.score,
        viewer_human_vote_direction: options?.viewer_user_id
          ? this.deps.humanVoteRepo.findByVoterAndTarget(
            options.viewer_user_id,
            'AUDIENCE_MESSAGE',
            message.id,
          )?.direction ?? null
          : null,
      }
    })
  }

  async createAcceptedMessage(input: {
    post_id: string
    actor_user_id: string
    body: string
    parent_message_id?: string | null
    quoted_turn?: QuotedTurnInput | null
  }) {
    const trimmed = input.body?.trim()
    if (!trimmed) {
      throw new ValidationError('body must be a non-empty string')
    }

    const post = await this.deps.postRepo.findById(input.post_id)
    if (!post) throw new NotFoundError('Post', input.post_id)

    const thread = await this.deps.audienceRepo.upsertThreadByPost({
      post_id: post.id,
      community_id: post.community_id,
      status: 'OPEN',
    })

    let parent: AudienceMessage | null = null
    if (input.parent_message_id) {
      parent = await this.deps.audienceRepo.findMessageById(input.parent_message_id)
      if (!parent || parent.thread_id !== thread.id) {
        throw new NotFoundError('AudienceMessage', input.parent_message_id)
      }
      if (parent.deleted_at) {
        throw new ValidationError('Cannot reply to a deleted audience message')
      }
      if (parent.parent_message_id) {
        throw new ValidationError(
          'Audience replies support only one nesting level; pick the top-level message instead.',
        )
      }
    }

    const quoted = input.quoted_turn ?? null
    if (quoted) {
      if (!quoted.turn_id) throw new ValidationError('quoted_turn.turn_id is required')
      if (!quoted.excerpt) throw new ValidationError('quoted_turn.excerpt is required')
    }

    const message = await this.deps.audienceRepo.createMessage({
      thread_id: thread.id,
      author_user_id: input.actor_user_id,
      body: trimmed,
      parent_message_id: parent?.id ?? null,
      quoted_turn_id: quoted?.turn_id ?? null,
      quoted_turn_excerpt: quoted?.excerpt ?? null,
      quoted_turn_author_name: quoted?.author_display_name ?? null,
    })

    return {
      thread,
      message,
    }
  }

  async softDeleteMessage(input: { actor_user_id: string; message_id: string }) {
    const message = await this.deps.audienceRepo.findMessageById(input.message_id)
    if (!message) throw new NotFoundError('AudienceMessage', input.message_id)
    if (message.deleted_at) return message
    if (message.author_user_id !== input.actor_user_id) {
      throw new ForbiddenError('Only the author can delete an audience message')
    }
    await this.deps.audienceRepo.softDeleteMessage(input.message_id)
    return { ...message, deleted_at: new Date() }
  }

}

function sortAggregated(
  messages: readonly AudienceMessageAggregate[],
  sort: AudienceThreadSort,
): AudienceMessageAggregate[] {
  // The aggregated list still mixes top-level messages and their replies; the
  // caller is responsible for nesting replies after the sort decides top-level
  // ordering. Here we only ensure the projection is ordered deterministically.
  const tops = messages.filter((message) => !message.parent_message_id)
  const repliesByParent = new Map<string, AudienceMessageAggregate[]>()
  for (const message of messages) {
    if (!message.parent_message_id) continue
    const bucket = repliesByParent.get(message.parent_message_id) ?? []
    bucket.push(message)
    repliesByParent.set(message.parent_message_id, bucket)
  }
  for (const bucket of repliesByParent.values()) {
    bucket.sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
  }
  const sortedTops = [...tops].sort((a, b) => {
    if (sort === 'top') {
      if (b.human_vote_score !== a.human_vote_score) return b.human_vote_score - a.human_vote_score
      return b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id)
    }
    return b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id)
  })
  // Flatten: top message followed immediately by its replies (in chronological asc).
  // Consumers that want strict nested structure can regroup by parent_message_id.
  const result: AudienceMessageAggregate[] = []
  for (const top of sortedTops) {
    result.push(top)
    const replies = repliesByParent.get(top.id)
    if (replies) result.push(...replies)
  }
  return result
}
