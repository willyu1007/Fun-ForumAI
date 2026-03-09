import { describe, expect, it } from 'vitest'
import {
  PgContextRelationStateRepository,
  PgEpisodicCardRepository,
  PgRawContextEventRepository,
} from '../pg/pg-context-memory-repository.js'

describe('Pg context-memory repositories', () => {
  it('normalizes raw context event enums back to domain casing', async () => {
    const repo = new PgRawContextEventRepository({
      rawContextEvent: {
        findUnique: async () => ({
          id: 'evt-1',
          agentId: 'agent-1',
          scene: 'PRIVATE_CHAT',
          sourceType: 'PRIVATE_SESSION',
          sourceRefId: 'session-1',
          counterpartId: 'owner-1',
          transcript: 'Owner: hi',
          evidenceRefs: ['private_session:session-1'],
          createdAt: new Date('2026-03-09T10:00:00.000Z'),
        }),
      },
    } as never)

    const event = await repo.findById('evt-1')

    expect(event).toMatchObject({
      scene: 'private_chat',
      source_type: 'private_session',
      source_ref_id: 'session-1',
      counterpart_id: 'owner-1',
    })
  })

  it('normalizes episodic card scene and relation channel enums', async () => {
    const episodicRepo = new PgEpisodicCardRepository({
      episodicCard: {
        findMany: async () => [
          {
            id: 'card-1',
            agentId: 'agent-1',
            eventId: 'evt-1',
            scene: 'PRIVATE_CHAT',
            title: 'private card',
            summary: 'summary',
            topicTags: ['coffee'],
            evidenceRefs: ['evt-1'],
            salience: 0.8,
            createdAt: new Date('2026-03-09T10:00:00.000Z'),
            updatedAt: new Date('2026-03-09T10:00:00.000Z'),
          },
        ],
      },
    } as never)
    const relationRepo = new PgContextRelationStateRepository({
      contextRelationState: {
        findUnique: async () => ({
          id: 'rel-1',
          agentId: 'agent-1',
          counterpartId: 'owner-1',
          channel: 'OWNER',
          stance: 'trusting',
          confidence: 0.9,
          evidenceRefs: ['evt-1'],
          updatedAt: new Date('2026-03-09T10:00:00.000Z'),
        }),
      },
    } as never)

    const cards = await episodicRepo.listByAgent('agent-1', { limit: 5 })
    const relation = await relationRepo.findByCounterpart('agent-1', 'owner-1', 'owner')

    expect(cards.items[0]).toMatchObject({
      scene: 'private_chat',
      event_id: 'evt-1',
    })
    expect(relation).toMatchObject({
      channel: 'owner',
      stance: 'trusting',
    })
  })
})
