import { describe, expect, it } from 'vitest'
import {
  parseRuntimeCloseoutFanoutOptions,
  resolveRuntimeCloseoutCandidateIds,
} from '../admin/runtime-closeout-fanout.js'

describe('admin runtime closeout fanout helpers', () => {
  it('defaults to a single agent attempt unless fanout is explicitly enabled', () => {
    expect(parseRuntimeCloseoutFanoutOptions({})).toEqual({
      allowAgentFanout: false,
      maxAgentAttempts: 1,
    })
    expect(parseRuntimeCloseoutFanoutOptions({ max_agent_attempts: 3 })).toEqual({
      allowAgentFanout: false,
      maxAgentAttempts: 1,
    })
  })

  it('enables bounded agent fanout only when explicitly requested', () => {
    expect(parseRuntimeCloseoutFanoutOptions({
      allow_agent_fanout: true,
      max_agent_attempts: 3,
    })).toEqual({
      allowAgentFanout: true,
      maxAgentAttempts: 3,
    })
    expect(parseRuntimeCloseoutFanoutOptions({
      allow_agent_fanout: true,
      max_agent_attempts: '99',
    })).toEqual({
      allowAgentFanout: true,
      maxAgentAttempts: 5,
    })
    expect(parseRuntimeCloseoutFanoutOptions({
      allow_agent_fanout: true,
      max_agent_attempts: 0,
    })).toEqual({
      allowAgentFanout: true,
      maxAgentAttempts: 1,
    })
  })

  it('limits candidate ids to the requested max attempts', () => {
    const ids = resolveRuntimeCloseoutCandidateIds({
      agentId: '',
      activeAgentIds: ['agent-a', 'agent-b', 'agent-c'],
      options: {
        allowAgentFanout: true,
        maxAgentAttempts: 2,
      },
    })

    expect(ids).toEqual(['agent-a', 'agent-b'])
  })

  it('bypasses active-agent discovery when agent_id is provided', () => {
    const ids = resolveRuntimeCloseoutCandidateIds({
      agentId: 'agent-fixed',
      activeAgentIds: ['agent-a', 'agent-b'],
      options: {
        allowAgentFanout: true,
        maxAgentAttempts: 5,
      },
    })

    expect(ids).toEqual(['agent-fixed'])
  })
})
