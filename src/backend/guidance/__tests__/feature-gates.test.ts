import { describe, expect, it, vi } from 'vitest'
import { handleGuidanceDigestHook, handleGuidanceForumFanout, type GuidanceDigestHookInput } from '../feature-gates.js'
import type { Agent, DomainEvent } from '../../repos/types.js'

function buildDigestInput(overrides: Partial<GuidanceDigestHookInput> = {}): GuidanceDigestHookInput {
  return {
    agent_id: 'agent-1',
    session_id: 'session-1',
    memory_id: 'memory-1',
    importance_score: 0.9,
    sentiment: 'positive',
    ...overrides,
  }
}

function buildForumEvent(): DomainEvent {
  return {
    id: 'evt-1',
    event_type: 'POST_CREATED',
    plane: 'DATA',
    schema_version: 'v1',
    community_id: null,
    post_id: 'post-1',
    room_id: null,
    actor_type: 'agent',
    actor_id: 'agent-1',
    cause_event_id: null,
    correlation_id: 'run-1',
    payload_json: {
      id: 'post-1',
      author_agent_id: 'agent-1',
      visibility: 'PUBLIC',
      state: 'APPROVED',
    },
    idempotency_key: null,
    created_at: new Date('2026-03-10T00:00:00.000Z'),
  }
}

function buildAgent(): Agent {
  const now = new Date('2026-03-10T00:00:00.000Z')
  return {
    id: 'agent-1',
    owner_id: 'owner-1',
    display_name: 'Owner Bot',
    avatar_url: null,
    model: 'gpt-test',
    persona_version: 1,
    reputation_score: 0,
    status: 'ACTIVE',
    created_at: now,
    updated_at: now,
  }
}

describe('guidance feature gates', () => {
  it('suppresses digest hook ingestion while guidance is disabled', async () => {
    const ingestEvent = vi.fn()
    const agentRepo = {
      findById: vi.fn(() => buildAgent()),
    }

    await handleGuidanceDigestHook(buildDigestInput(), {
      guidanceEnabled: false,
      agentRepo,
      orchestrator: { ingestEvent } as never,
    })

    expect(agentRepo.findById).not.toHaveBeenCalled()
    expect(ingestEvent).not.toHaveBeenCalled()
  })

  it('forwards digest completions to the owner actor when guidance is enabled', async () => {
    const ingestEvent = vi.fn()
    const agentRepo = {
      findById: vi.fn(() => buildAgent()),
    }

    await handleGuidanceDigestHook(buildDigestInput(), {
      guidanceEnabled: true,
      agentRepo,
      orchestrator: { ingestEvent } as never,
    })

    expect(ingestEvent).toHaveBeenCalledWith(
      { actor_type: 'USER', actor_id: 'owner-1' },
      'PRIVATE_DIGEST_READY',
      {
        agent_id: 'agent-1',
        session_id: 'session-1',
        memory_id: 'memory-1',
      },
      { dedup_key: 'private_digest_ready:session-1' },
    )
  })

  it('suppresses forum fan-out while guidance is disabled', () => {
    const handleForumEvent = vi.fn(() => Promise.resolve())

    handleGuidanceForumFanout(buildForumEvent(), {
      guidanceEnabled: false,
      orchestrator: { handleForumEvent } as never,
    })

    expect(handleForumEvent).not.toHaveBeenCalled()
  })

  it('forwards forum events while guidance is enabled', () => {
    const handleForumEvent = vi.fn(() => Promise.resolve())

    handleGuidanceForumFanout(buildForumEvent(), {
      guidanceEnabled: true,
      orchestrator: { handleForumEvent } as never,
    })

    expect(handleForumEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt-1' }))
  })
})
