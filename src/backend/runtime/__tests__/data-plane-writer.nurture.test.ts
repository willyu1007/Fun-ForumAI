import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WriteInstruction } from '../types.js'

const ORIGINAL_FF_NURTURE_PIPELINE_V2 = process.env.FF_NURTURE_PIPELINE_V2

async function importWriterWithFlag(flagOn: boolean) {
  process.env.FF_NURTURE_PIPELINE_V2 = flagOn ? 'true' : 'false'
  vi.resetModules()
  return import('../data-plane-writer.js')
}

function makeUsage() {
  return {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
  }
}

afterEach(() => {
  if (ORIGINAL_FF_NURTURE_PIPELINE_V2 === undefined) {
    delete process.env.FF_NURTURE_PIPELINE_V2
  } else {
    process.env.FF_NURTURE_PIPELINE_V2 = ORIGINAL_FF_NURTURE_PIPELINE_V2
  }
  vi.resetModules()
  vi.clearAllMocks()
})

describe('DataPlaneWriter nurture routing', () => {
  it('routes forum post XP to orchestrator when FF_NURTURE_PIPELINE_V2=true', async () => {
    const { DataPlaneWriter } = await importWriterWithFlag(true)

    const createPost = vi.fn().mockResolvedValue({ post: { id: 'post-1' } })
    const createComment = vi.fn()
    const onContentProduced = vi.fn().mockResolvedValue(undefined)
    const awardXP = vi.fn().mockResolvedValue(undefined)

    const writer = new DataPlaneWriter({
      forumWriteService: { createPost, createComment } as never,
      agentRunRepo: { create: vi.fn() } as never,
      chatService: { sendMessage: vi.fn() } as never,
      nurtureOrchestrator: { onContentProduced } as never,
      xpService: { awardXP } as never,
    })

    const instruction: WriteInstruction = {
      action: 'create_post',
      community_id: 'community-1',
      title: 'hello',
      body: 'world',
    }

    const result = await writer.write(instruction, 'agent-1', 'evt-1', makeUsage(), 10, 4)

    expect(result).toEqual({ success: true, content_id: 'post-1' })
    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({ chain_depth: 5 }))
    expect(onContentProduced).toHaveBeenCalledWith('agent-1', 'forum_post', 1, {
      dedup_key: 'content:post-1',
    })
    expect(awardXP).not.toHaveBeenCalled()
  })

  it('falls back to growth engine when FF_NURTURE_PIPELINE_V2=false', async () => {
    const { DataPlaneWriter } = await importWriterWithFlag(false)

    const createComment = vi.fn().mockResolvedValue({ comment: { id: 'comment-1' } })
    const onContentProduced = vi.fn().mockResolvedValue(undefined)
    const awardXP = vi.fn().mockResolvedValue(undefined)

    const writer = new DataPlaneWriter({
      forumWriteService: { createPost: vi.fn(), createComment } as never,
      agentRunRepo: { create: vi.fn() } as never,
      chatService: { sendMessage: vi.fn() } as never,
      nurtureOrchestrator: { onContentProduced } as never,
      xpService: { awardXP } as never,
    })

    const instruction: WriteInstruction = {
      action: 'create_comment',
      community_id: 'community-1',
      post_id: 'post-1',
      body: 'reply',
    }

    const result = await writer.write(instruction, 'agent-1', 'evt-1', makeUsage(), 10, 2)

    expect(result).toEqual({ success: true, content_id: 'comment-1' })
    expect(createComment).toHaveBeenCalledWith(expect.objectContaining({ chain_depth: 3 }))
    expect(onContentProduced).not.toHaveBeenCalled()
    expect(awardXP).toHaveBeenCalledWith('agent-1', 'forum_comment', 1)
  })

  it('does not issue extra XP in create_message path (chat service owns message XP)', async () => {
    const { DataPlaneWriter } = await importWriterWithFlag(true)

    const sendMessage = vi.fn().mockResolvedValue({
      id: 'msg-1',
      room_id: 'room-1',
      author_id: 'agent-1',
      body: 'hello room',
      message_kind: 'normal',
      created_at: new Date(),
    })
    const onContentProduced = vi.fn().mockResolvedValue(undefined)
    const awardXP = vi.fn().mockResolvedValue(undefined)

    const writer = new DataPlaneWriter({
      forumWriteService: { createPost: vi.fn(), createComment: vi.fn() } as never,
      agentRunRepo: { create: vi.fn() } as never,
      chatService: { sendMessage } as never,
      nurtureOrchestrator: { onContentProduced } as never,
      xpService: { awardXP } as never,
    })

    const instruction: WriteInstruction = {
      action: 'create_message',
      community_id: 'community-1',
      room_id: 'room-1',
      body: 'hello room',
      message_kind: 'normal',
    }

    const result = await writer.write(instruction, 'agent-1', 'evt-1', makeUsage(), 10)

    expect(result).toEqual({ success: true, content_id: 'msg-1' })
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(onContentProduced).not.toHaveBeenCalled()
    expect(awardXP).not.toHaveBeenCalled()
  })

  it('records a failed write AgentRun when visible content persistence fails', async () => {
    const { DataPlaneWriter } = await importWriterWithFlag(true)
    const { buildPersonaObservation } = await import('../persona-observation.js')

    const agentRunCreate = vi.fn()
    const createPost = vi.fn().mockRejectedValue(new Error('db down'))

    const writer = new DataPlaneWriter({
      forumWriteService: { createPost, createComment: vi.fn() } as never,
      agentRunRepo: { create: agentRunCreate } as never,
      chatService: { sendMessage: vi.fn() } as never,
      nurtureOrchestrator: { onContentProduced: vi.fn() } as never,
      xpService: { awardXP: vi.fn() } as never,
    })

    const observation = buildPersonaObservation({
      sourceCallsiteId: 'post-scheduler-create-post',
      scene: 'scheduled_post',
      intent: 'scheduled_post',
      visibility: 'visible',
      coverageStatus: 'visible_complete',
      personaSeedCode: 'scholar',
      homeVoiceLineId: 'qwen-social-v1',
      requestedTier: 'base',
      resolvedTier: 'base',
      usage: makeUsage(),
      latencyMs: 10,
      parseSuccess: true,
    })

    const result = await writer.write(
      {
        action: 'create_post',
        community_id: 'community-1',
        title: 'hello',
        body: 'world',
      },
      'agent-1',
      'evt-1',
      makeUsage(),
      10,
      0,
      observation,
    )

    expect(result).toEqual({ success: false, error: 'db down' })
    expect(agentRunCreate).toHaveBeenCalledTimes(1)
    expect(agentRunCreate).toHaveBeenCalledWith(expect.objectContaining({
      agent_id: 'agent-1',
      trigger_event_id: 'evt-1',
      input_digest: 'write_failed|action:create_post|body_len:5',
      output_json: expect.objectContaining({
        action: 'create_post',
        error: 'db down',
        persona_observation: expect.objectContaining({
          source_callsite_id: 'post-scheduler-create-post',
          coverage_status: 'visible_complete',
          error: 'db down',
        }),
      }),
    }))
  })
})
