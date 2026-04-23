import { describe, expect, it } from 'vitest'
import { parseForumActionPlan } from '../forum-action-plan-parser.js'

describe('parseForumActionPlan', () => {
  it('accepts plain no_write without reason and normalizes a default reason', () => {
    const result = parseForumActionPlan(JSON.stringify({
      version: 'v1',
      actions: [{ kind: 'no_write' }],
    }))

    expect(result).toEqual({
      status: 'ok',
      plan: {
        version: 'v1',
        actions: [{ kind: 'no_write', reason: 'no_write' }],
      },
    })
  })

  it('accepts no_write with an explicit reason', () => {
    const result = parseForumActionPlan(JSON.stringify({
      version: 'v1',
      actions: [{ kind: 'no_write', reason: 'observe_only' }],
    }))

    expect(result).toEqual({
      status: 'ok',
      plan: {
        version: 'v1',
        actions: [{ kind: 'no_write', reason: 'observe_only' }],
      },
    })
  })

  it('keeps no_write mixed with another action invalid', () => {
    const result = parseForumActionPlan(JSON.stringify({
      version: 'v1',
      actions: [
        { kind: 'no_write' },
        { kind: 'vote', target_ref: 'event_post', direction: 'UP' },
      ],
    }))

    expect(result).toEqual({
      status: 'invalid',
      reason: 'invalid_combination',
      plan: null,
    })
  })

  it('accepts canonical vote rationale_code values', () => {
    const result = parseForumActionPlan(JSON.stringify({
      version: 'v1',
      actions: [
        {
          kind: 'vote',
          target_ref: 'event_post',
          direction: 'DOWN',
          confidence: 0.9,
          rationale_code: 'weak_reasoning',
        },
      ],
    }))

    expect(result).toEqual({
      status: 'ok',
      plan: {
        version: 'v1',
        actions: [
          {
            kind: 'vote',
            target_ref: 'event_post',
            direction: 'DOWN',
            confidence: 0.9,
            rationale_code: 'weak_reasoning',
          },
        ],
      },
    })
  })

  it('drops unknown string rationale_code values instead of rejecting the whole plan', () => {
    const result = parseForumActionPlan(JSON.stringify({
      version: 'v1',
      actions: [
        {
          kind: 'vote',
          target_ref: 'event_post',
          direction: 'DOWN',
          confidence: 0.9,
          rationale_code: 'invalid_content',
        },
      ],
    }))

    expect(result).toEqual({
      status: 'ok',
      plan: {
        version: 'v1',
        actions: [
          {
            kind: 'vote',
            target_ref: 'event_post',
            direction: 'DOWN',
            confidence: 0.9,
          },
        ],
      },
    })
  })

  it('keeps non-string rationale_code values invalid', () => {
    const result = parseForumActionPlan(JSON.stringify({
      version: 'v1',
      actions: [
        {
          kind: 'vote',
          target_ref: 'event_post',
          direction: 'DOWN',
          confidence: 0.9,
          rationale_code: 42,
        },
      ],
    }))

    expect(result).toEqual({
      status: 'invalid',
      reason: 'invalid_shape',
      plan: null,
    })
  })
})
