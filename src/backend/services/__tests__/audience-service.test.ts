import { describe, expect, it, beforeEach } from 'vitest'
import { AudienceService } from '../audience-service.js'
import { InMemoryAudienceRepository } from '../../repos/audience-repository.js'
import { InMemoryPostRepository } from '../../repos/post-repository.js'
import { InMemoryHumanVoteRepository } from '../../repos/human-vote-repository.js'
import type { PostRepository } from '../../repos/index.js'
import type { AudienceRepository } from '../../repos/audience-repository.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js'

function authorLookupStub() {
  return {
    async resolve(ids: readonly string[]) {
      return new Map(
        ids.map((id) => [
          id,
          {
            id,
            display_name: `Display-${id.slice(0, 4)}`,
            avatar_url: null,
          },
        ]),
      )
    },
  }
}

async function seedPost(postRepo: PostRepository, overrides?: { id?: string }) {
  return postRepo.create({
    id: overrides?.id ?? 'post-1',
    community_id: 'community-1',
    author_agent_id: 'agent-1',
    title: 'Test',
    body: 'Body',
    visibility: 'PUBLIC',
    state: 'APPROVED',
  } as never)
}

describe('AudienceService', () => {
  let postRepo: PostRepository
  let audienceRepo: AudienceRepository
  let humanVoteRepo: InMemoryHumanVoteRepository
  let service: AudienceService

  beforeEach(async () => {
    postRepo = new InMemoryPostRepository()
    audienceRepo = new InMemoryAudienceRepository()
    humanVoteRepo = new InMemoryHumanVoteRepository()
    service = new AudienceService({
      postRepo,
      audienceRepo,
      humanVoteRepo,
      authorLookup: authorLookupStub(),
    })
    await seedPost(postRepo)
  })

  it('creates a top-level message and returns it via the aggregated projection', async () => {
    const created = await service.createAcceptedMessage({
      post_id: 'post-1',
      actor_user_id: 'user-1',
      body: 'Hello audience',
    })
    expect(created.message.body).toBe('Hello audience')

    const { messages } = await service.getThreadByPost('post-1', {
      viewer_user_id: 'user-1',
      sort: 'latest',
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]!.body).toBe('Hello audience')
    expect(messages[0]!.author.display_name).toBe('Display-user')
    expect(messages[0]!.human_vote_score).toBe(0)
    expect(messages[0]!.viewer_human_vote_direction).toBeNull()
  })

  it('accepts a one-level reply and rejects nested replies', async () => {
    const top = await service.createAcceptedMessage({
      post_id: 'post-1',
      actor_user_id: 'user-1',
      body: 'Parent',
    })
    const reply = await service.createAcceptedMessage({
      post_id: 'post-1',
      actor_user_id: 'user-2',
      body: 'Child',
      parent_message_id: top.message.id,
    })
    expect(reply.message.parent_message_id).toBe(top.message.id)

    await expect(
      service.createAcceptedMessage({
        post_id: 'post-1',
        actor_user_id: 'user-3',
        body: 'Grandchild',
        parent_message_id: reply.message.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects replies to deleted messages', async () => {
    const top = await service.createAcceptedMessage({
      post_id: 'post-1',
      actor_user_id: 'user-1',
      body: 'Parent',
    })
    await service.softDeleteMessage({ actor_user_id: 'user-1', message_id: top.message.id })
    await expect(
      service.createAcceptedMessage({
        post_id: 'post-1',
        actor_user_id: 'user-2',
        body: 'Child',
        parent_message_id: top.message.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('stores quoted turn metadata on the message', async () => {
    const result = await service.createAcceptedMessage({
      post_id: 'post-1',
      actor_user_id: 'user-1',
      body: 'with quote',
      quoted_turn: { turn_id: 'turn-1', excerpt: 'hello', author_display_name: 'Agent 7' },
    })
    expect(result.message.quoted_turn_id).toBe('turn-1')
    expect(result.message.quoted_turn_excerpt).toBe('hello')
    expect(result.message.quoted_turn_author_name).toBe('Agent 7')
  })

  it('validates body and quoted_turn fields', async () => {
    await expect(
      service.createAcceptedMessage({ post_id: 'post-1', actor_user_id: 'user-1', body: '   ' }),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      service.createAcceptedMessage({
        post_id: 'post-1',
        actor_user_id: 'user-1',
        body: 'ok',
        quoted_turn: { turn_id: '', excerpt: 'x' },
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    await expect(
      service.createAcceptedMessage({
        post_id: 'post-1',
        actor_user_id: 'user-1',
        body: 'ok',
        quoted_turn: { turn_id: 'turn-1', excerpt: '' },
      }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('only the author can soft-delete a message', async () => {
    const top = await service.createAcceptedMessage({
      post_id: 'post-1',
      actor_user_id: 'user-1',
      body: 'mine',
    })
    await expect(
      service.softDeleteMessage({ actor_user_id: 'user-42', message_id: top.message.id }),
    ).rejects.toBeInstanceOf(ForbiddenError)
    await service.softDeleteMessage({ actor_user_id: 'user-1', message_id: top.message.id })
    const { messages } = await service.getThreadByPost('post-1', { viewer_user_id: 'user-1' })
    expect(messages[0]!.deleted_at).toBeInstanceOf(Date)
  })

  it('projects audience message human votes from the generic vote repo', async () => {
    const created = await service.createAcceptedMessage({
      post_id: 'post-1',
      actor_user_id: 'user-1',
      body: 'hello',
    })

    await humanVoteRepo.upsert({
      voter_user_id: 'user-2',
      target_type: 'AUDIENCE_MESSAGE',
      target_id: created.message.id,
      direction: 'UP',
    })
    await humanVoteRepo.upsert({
      voter_user_id: 'user-3',
      target_type: 'AUDIENCE_MESSAGE',
      target_id: created.message.id,
      direction: 'DOWN',
    })

    const { messages } = await service.getThreadByPost('post-1', {
      viewer_user_id: 'user-2',
    })

    expect(messages[0]!.human_vote_up).toBe(1)
    expect(messages[0]!.human_vote_down).toBe(1)
    expect(messages[0]!.human_vote_score).toBe(0)
    expect(messages[0]!.viewer_human_vote_direction).toBe('UP')
  })

  it('sorts by top using human_vote_score desc and includes viewer_human_vote_direction', async () => {
    const m1 = await service.createAcceptedMessage({
      post_id: 'post-1',
      actor_user_id: 'user-1',
      body: 'cold',
    })
    const m2 = await service.createAcceptedMessage({
      post_id: 'post-1',
      actor_user_id: 'user-2',
      body: 'hot',
    })
    await humanVoteRepo.upsert({
      voter_user_id: 'user-3',
      target_type: 'AUDIENCE_MESSAGE',
      target_id: m2.message.id,
      direction: 'UP',
    })
    await humanVoteRepo.upsert({
      voter_user_id: 'user-4',
      target_type: 'AUDIENCE_MESSAGE',
      target_id: m2.message.id,
      direction: 'UP',
    })

    const { messages } = await service.getThreadByPost('post-1', {
      sort: 'top',
      viewer_user_id: 'user-3',
    })
    expect(messages[0]!.id).toBe(m2.message.id)
    expect(messages[0]!.viewer_human_vote_direction).toBe('UP')
    expect(messages[1]!.id).toBe(m1.message.id)
  })

  it('throws NotFoundError when the post does not exist', async () => {
    await expect(
      service.createAcceptedMessage({
        post_id: 'missing',
        actor_user_id: 'user-1',
        body: 'hi',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})
