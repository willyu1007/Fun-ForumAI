import { describe, expect, it } from 'vitest'
import { ResponseParser } from '../response-parser.js'
import type { ExecutionContext } from '../types.js'

function buildThreadReplyContext(
  overrides: Partial<ExecutionContext> = {},
): ExecutionContext {
  return {
    event: {
      event_id: 'evt-thread-1',
      event_type: 'ThreadTurnAdded',
      idempotency_key: 'idem-thread-1',
      chain_depth: 1,
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      turn_id: 'turn-3',
      author_agent_id: 'agent-2',
      created_at: new Date('2026-04-09T00:00:00.000Z').toISOString(),
    },
    agent: {
      agent_id: 'agent-1',
      score: 1,
      priority: 1,
    },
    persona: {
      name: 'Parser Bot',
      style: 'direct',
      interests: ['forums'],
      language: 'zh-CN',
    },
    community: {
      id: 'community-1',
      name: '测试社区',
      description: '',
      rules: '',
    },
    post: {
      id: 'post-1',
      title: '帖子标题',
      body: '帖子正文',
      author_agent_id: 'agent-2',
      author_name: 'Other Bot',
    },
    forum_targeting: {
      event_target_entry_id: 'turn-3',
      event_target_thread_id: 'thread-1',
      focus_turn_id: 'turn-2',
      selected_anchor_turn_id: 'turn-2',
      actual_anchor_turn_id: 'turn-1',
      final_write_anchor_turn_id: 'turn-1',
      reply_thread_id: 'thread-1',
      browse_reason: 'REVIVE',
      allowed_actions: ['REPLY', 'IGNORE'],
    },
    ...overrides,
  } as ExecutionContext
}

describe('ResponseParser', () => {
  it('anchors thread replies to the resolved final write anchor', () => {
    const parser = new ResponseParser()

    const result = parser.parse('回到之前那个点继续说。', buildThreadReplyContext())

    expect(result).toEqual({
      action: 'add_thread_turn',
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      anchor_turn_id: 'turn-1',
      body: '回到之前那个点继续说。',
    })
  })

  it('fails closed when a thread reply has no resolved reply_thread_id', () => {
    const parser = new ResponseParser()

    const result = parser.parse('这条回复不应该被接受。', buildThreadReplyContext({
      forum_targeting: {
        event_target_entry_id: 'turn-3',
        event_target_thread_id: 'thread-1',
        focus_turn_id: 'turn-2',
        selected_anchor_turn_id: 'turn-2',
        actual_anchor_turn_id: 'turn-1',
        final_write_anchor_turn_id: 'turn-1',
        reply_thread_id: null,
        browse_reason: 'REVIVE',
        allowed_actions: ['REPLY', 'IGNORE'],
      },
    }))

    expect(result).toBeNull()
  })

  it('allows root-level thread continuation when the resolved anchor is null', () => {
    const parser = new ResponseParser()

    const result = parser.parse('继续沿着整条线程往前推。', buildThreadReplyContext({
      forum_targeting: {
        event_target_entry_id: 'thread-1',
        event_target_thread_id: 'thread-1',
        focus_turn_id: null,
        selected_anchor_turn_id: null,
        actual_anchor_turn_id: null,
        final_write_anchor_turn_id: null,
        reply_thread_id: 'thread-1',
        browse_reason: 'TOPIC_MATCH',
        allowed_actions: ['REPLY', 'IGNORE'],
      },
    }))

    expect(result).toEqual({
      action: 'add_thread_turn',
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      body: '继续沿着整条线程往前推。',
    })
  })

  it('opens a sibling thread when a frozen roaming plan resolves to open_thread', () => {
    const parser = new ResponseParser()

    const result = parser.parse('那我换一条并列分支展开。', buildThreadReplyContext({
      forum_roaming: {
        arrival_candidates: [],
        decision_hint: null,
        decision_prompt_input: null,
        decision_result: {
          status: 'selected',
          candidate_id: 'sibling:thread-1',
          action: 'start_sibling_thread',
          raw_output: '{"candidate_id":"sibling:thread-1","action":"start_sibling_thread"}',
        },
        resolved_execution_plan: {
          candidate_id: 'sibling:thread-1',
          candidate_kind: 'sibling_thread_slot',
          decision_action: 'start_sibling_thread',
          write_action: 'open_thread',
          requires_generation: true,
          context_thread_id: 'thread-1',
          context_focus_turn_id: 'turn-2',
          context_anchor_turn_id: 'turn-1',
          write_thread_id: null,
          write_anchor_turn_id: null,
          route_handoff: null,
          validation_status: 'resolved',
        },
      },
    }))

    expect(result).toEqual({
      action: 'open_thread',
      community_id: 'community-1',
      post_id: 'post-1',
      body: '那我换一条并列分支展开。',
    })
  })

  it('attaches route_handoff when a frozen roaming plan resolves to handoff', () => {
    const parser = new ResponseParser()

    const result = parser.parse('这里我收一下口，转去私聊继续。', buildThreadReplyContext({
      forum_roaming: {
        arrival_candidates: [],
        decision_hint: null,
        decision_prompt_input: null,
        decision_result: {
          status: 'selected',
          candidate_id: 'branch:thread-1',
          action: 'handoff_or_route_elsewhere',
          raw_output: '{"candidate_id":"branch:thread-1","action":"handoff_or_route_elsewhere"}',
        },
        resolved_execution_plan: {
          candidate_id: 'branch:thread-1',
          candidate_kind: 'branch_entry',
          decision_action: 'handoff_or_route_elsewhere',
          write_action: 'add_thread_turn_with_route',
          requires_generation: true,
          context_thread_id: 'thread-1',
          context_focus_turn_id: 'turn-2',
          context_anchor_turn_id: 'turn-1',
          write_thread_id: 'thread-1',
          write_anchor_turn_id: 'turn-1',
          route_handoff: {
            route_type: 'PRIVATE',
            route_state: 'READY',
            reason_code: 'PRIVATE_HANDOFF_REQUIRED',
            handoff_label: '该话题适合转入私聊继续。',
            handoff_payload: null,
            cta: null,
          },
          validation_status: 'resolved',
        },
      },
    }))

    expect(result).toEqual({
      action: 'add_thread_turn',
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      anchor_turn_id: 'turn-1',
      route_handoff: {
        route_type: 'PRIVATE',
        route_state: 'READY',
        reason_code: 'PRIVATE_HANDOFF_REQUIRED',
        handoff_label: '该话题适合转入私聊继续。',
        handoff_payload: null,
        cta: null,
      },
      body: '这里我收一下口，转去私聊继续。',
    })
  })

  it('rejects scheduled_post JSON that retargets a locked community', () => {
    const parser = new ResponseParser()

    const result = parser.parseAsScheduledPost({
      text: '{"community_id":"community-2","title":"Title","body":"Body"}',
      fallbackCommunityId: 'community-1',
      lockedCommunityId: 'community-1',
      communities: [
        { id: 'community-1', slug: 'general', name: 'General' },
        { id: 'community-2', slug: 'tech', name: 'Tech' },
      ],
    })

    expect(result).toBeNull()
  })

  it('accepts scheduled_post JSON without a community when target is locked upstream', () => {
    const parser = new ResponseParser()

    const result = parser.parseAsScheduledPost({
      text: '{"title":"Title","body":"Body"}',
      fallbackCommunityId: 'community-1',
      lockedCommunityId: 'community-1',
      communities: [
        { id: 'community-1', slug: 'general', name: 'General' },
      ],
    })

    expect(result).toEqual({
      action: 'create_post',
      community_id: 'community-1',
      title: 'Title',
      body: 'Body',
    })
  })

  it('accepts labeled scheduled_post output', () => {
    const parser = new ResponseParser()

    const result = parser.parseAsScheduledPost({
      text: '标题：多模态调度测试\n\n正文：先把这个点抛出来。\n\n想看看大家会从哪个角度继续展开。',
      fallbackCommunityId: 'community-1',
      communities: [
        { id: 'community-1', slug: 'general', name: 'General' },
      ],
    })

    expect(result).toEqual({
      action: 'create_post',
      community_id: 'community-1',
      title: '多模态调度测试',
      body: '先把这个点抛出来。\n\n想看看大家会从哪个角度继续展开。',
    })
  })

  it('synthesizes a minimal body when the model returns a title only', () => {
    const parser = new ResponseParser()

    const result = parser.parseAsScheduledPost({
      text: '如何评估当前对话片段中的情绪张力与幽默感来源？',
      fallbackCommunityId: 'community-1',
      communities: [
        { id: 'community-1', slug: 'general', name: 'General' },
      ],
    })

    expect(result).toEqual({
      action: 'create_post',
      community_id: 'community-1',
      title: '如何评估当前对话片段中的情绪张力与幽默感来源？',
      body: '先把这个问题抛出来，想听听大家会怎么拆。\n\n你会先看表层反应，还是背后的动机和语境？',
    })
  })

  it('does not synthesize a body from malformed one-line JSON', () => {
    const parser = new ResponseParser()

    const result = parser.parseAsScheduledPost({
      text: '{"headline":"Only title"}',
      fallbackCommunityId: 'community-1',
      communities: [
        { id: 'community-1', slug: 'general', name: 'General' },
      ],
    })

    expect(result).toBeNull()
  })
})
