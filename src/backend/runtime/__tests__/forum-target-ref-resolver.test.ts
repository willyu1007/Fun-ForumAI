import { describe, expect, it } from 'vitest'
import {
  buildForumActionOptions,
  resolveForumActionPlanToInstructions,
} from '../forum-target-ref-resolver.js'
import type { RuntimeActionPlanV1 } from '../forum-action-contract.js'
import type { ExecutionContext } from '../types.js'

function buildThreadRootFocusContext(): ExecutionContext {
  return {
    event: {
      event_id: 'evt-thread-opened',
      event_type: 'ThreadOpened',
      idempotency_key: 'idem-thread-opened',
      chain_depth: 0,
      community_id: 'community-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      author_agent_id: 'agent-2',
      created_at: new Date().toISOString(),
    },
    agent: {
      agent_id: 'agent-1',
      score: 1,
      priority: 1,
    },
    persona: {
      name: 'Resolver Bot',
      style: 'precise',
      interests: ['forums'],
      language: 'zh-CN',
    },
    community: {
      id: 'community-1',
      name: '测试社区',
      description: '验证 fresh thread root resolver 行为',
      rules: '',
    },
    post: {
      id: 'post-1',
      title: '帖子标题',
      body: '帖子正文',
      author_agent_id: 'agent-2',
      author_name: 'Other Bot',
    },
    focusThreadTurn: {
      id: 'thread-1',
      post_id: 'post-1',
      thread_id: 'thread-1',
      entry_kind: 'THREAD',
      anchor_turn_id: null,
      body: '这是分支根节点。',
      author_agent_id: 'agent-3',
      author_name: 'Root Bot',
    },
    threadTurns: [
      {
        id: 'thread-1',
        post_id: 'post-1',
        thread_id: 'thread-1',
        entry_kind: 'THREAD',
        anchor_turn_id: null,
        body: '这是分支根节点。',
        author_agent_id: 'agent-3',
        author_name: 'Root Bot',
      },
    ],
    forum_targeting: {
      event_target_entry_id: 'thread-1',
      event_target_thread_id: 'thread-1',
      focus_turn_id: 'thread-1',
      selected_anchor_turn_id: null,
      actual_anchor_turn_id: null,
      final_write_anchor_turn_id: null,
      reply_thread_id: 'thread-1',
      browse_reason: 'DIRECT_CHALLENGE',
      allowed_actions: ['REPLY'],
    },
    blocks: {
      hard_control_block: 'hard',
      compact_control_block: 'compact',
      current_context_block: 'context',
      memory_block: 'memory',
      soft_expression_block: 'soft',
    },
  } as ExecutionContext
}

describe('forum-target-ref-resolver', () => {
  it('treats a thread-root focus entry as a thread vote target while keeping add_thread_turn available', () => {
    const options = buildForumActionOptions(buildThreadRootFocusContext())

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: 'focus_turn',
          target_type: 'THREAD',
          target_id: 'thread-1',
          allowed_actions: ['vote', 'add_thread_turn'],
        }),
        expect.objectContaining({
          ref: 'reply_thread',
          allowed_actions: ['add_thread_turn'],
        }),
      ]),
    )
  })

  it('does not synthesize a fake anchor turn when add_thread_turn targets a thread-root focus entry', () => {
    const plan = {
      version: 'v1',
      actions: [
        { kind: 'vote', target_ref: 'focus_turn', direction: 'UP', confidence: 0.9, rationale_code: 'agree' },
        { kind: 'add_thread_turn', target_ref: 'focus_turn' },
      ],
    } satisfies RuntimeActionPlanV1

    const result = resolveForumActionPlanToInstructions(buildThreadRootFocusContext(), plan)

    expect(result.dropped_actions).toEqual([])
    expect(result.resolved_instructions).toEqual([
      expect.objectContaining({
        action: 'vote',
        target_type: 'THREAD',
        target_id: 'thread-1',
        direction: 'UP',
      }),
      expect.objectContaining({
        action: 'add_thread_turn',
        thread_id: 'thread-1',
      }),
    ])
    expect(result.resolved_instructions[1]).not.toHaveProperty('anchor_turn_id')
  })
})
