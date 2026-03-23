import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WriteInstruction } from '../types.js'

function makeUsage() {
  return {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('DataPlaneWriter nurture routing', () => {
  it('routes forum post XP to orchestrator when available', async () => {
    const { DataPlaneWriter } = await import('../data-plane-writer.js')

    const createPost = vi.fn().mockResolvedValue({ post: { id: 'post-1' } })
    const createThread = vi.fn()
    const addThreadTurn = vi.fn()
    const onContentProduced = vi.fn().mockResolvedValue(undefined)
    const awardXP = vi.fn().mockResolvedValue(undefined)

    const writer = new DataPlaneWriter({
      forumWriteService: { createPost, createThread, addThreadTurn } as never,
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

  it('falls back to growth engine when nurture orchestrator is unavailable', async () => {
    const { DataPlaneWriter } = await import('../data-plane-writer.js')

    const createThread = vi.fn().mockResolvedValue({ comment: { id: 'thread-1' } })
    const onContentProduced = vi.fn().mockResolvedValue(undefined)
    const awardXP = vi.fn().mockResolvedValue(undefined)

    const writer = new DataPlaneWriter({
      forumWriteService: { createPost: vi.fn(), createThread, addThreadTurn: vi.fn() } as never,
      agentRunRepo: { create: vi.fn() } as never,
      chatService: { sendMessage: vi.fn() } as never,
      xpService: { awardXP } as never,
    })

    const instruction: WriteInstruction = {
      action: 'open_thread',
      community_id: 'community-1',
      post_id: 'post-1',
      body: 'reply',
    }

    const result = await writer.write(instruction, 'agent-1', 'evt-1', makeUsage(), 10, 2)

    expect(result).toEqual({ success: true, content_id: 'thread-1' })
    expect(createThread).toHaveBeenCalledWith(expect.objectContaining({ chain_depth: 3 }))
    expect(onContentProduced).not.toHaveBeenCalled()
    expect(awardXP).toHaveBeenCalledWith('agent-1', 'forum_thread', 1)
  })

  it('keeps post persistence successful when applyImagePlanAfterPersist fails', async () => {
    const { DataPlaneWriter } = await import('../data-plane-writer.js')

    const agentRunCreate = vi.fn()
    const createPost = vi.fn().mockResolvedValue({ post: { id: 'post-1' } })
    const applyImagePlanAfterPersist = vi.fn().mockRejectedValue(new Error('projection failed'))

    const writer = new DataPlaneWriter({
      forumWriteService: { createPost, createThread: vi.fn(), addThreadTurn: vi.fn() } as never,
      agentRunRepo: { create: agentRunCreate } as never,
      chatService: { sendMessage: vi.fn() } as never,
      nurtureOrchestrator: { onContentProduced: vi.fn().mockResolvedValue(undefined) } as never,
      xpService: { awardXP: vi.fn().mockResolvedValue(undefined) } as never,
      mediaWriteBridge: { applyImagePlanAfterPersist } as never,
    })

    const instruction: WriteInstruction = {
      action: 'create_post',
      community_id: 'community-1',
      title: 'hello',
      body: 'world',
      image_plan_id: 'image-plan-1',
      display_attachment_refs: [{
        asset_id: 'asset-1',
        slot: 0,
        display_variant: 'original',
      }],
    }

    const result = await writer.write(instruction, 'agent-1', 'evt-1', makeUsage(), 10)

    expect(result).toEqual({ success: true, content_id: 'post-1' })
    expect(applyImagePlanAfterPersist).toHaveBeenCalledWith({
      image_plan_id: 'image-plan-1',
      scene_type: 'forum_post',
      scene_id: 'post-1',
      created_by_id: 'agent-1',
    })
    expect(agentRunCreate).toHaveBeenCalledTimes(1)
    expect(agentRunCreate).toHaveBeenCalledWith(expect.objectContaining({
      output_json: expect.objectContaining({
        image_plan: expect.objectContaining({
          image_plan_id: 'image-plan-1',
          apply_after_persist_status: 'failed',
          apply_after_persist_error: 'projection failed',
        }),
      }),
    }))
  })

  it('does not issue extra XP in create_message path (chat service owns message XP)', async () => {
    const { DataPlaneWriter } = await import('../data-plane-writer.js')

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
      forumWriteService: { createPost: vi.fn(), createThread: vi.fn(), addThreadTurn: vi.fn() } as never,
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
    const { DataPlaneWriter } = await import('../data-plane-writer.js')
    const { buildPersonaObservation } = await import('../persona-observation.js')

    const agentRunCreate = vi.fn()
    const createPost = vi.fn().mockRejectedValue(new Error('db down'))

    const writer = new DataPlaneWriter({
      forumWriteService: { createPost, createThread: vi.fn(), addThreadTurn: vi.fn() } as never,
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
