import { describe, expect, it } from 'vitest'
import {
  resolveLeftRailDisplayAgents,
  sortAgentsByCreatedAt,
} from '../left-rail-agent-display'

const AGENTS = [
  {
    id: 'agent-3',
    display_name: 'Gamma',
    created_at: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'agent-1',
    display_name: 'Alpha',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'agent-4',
    display_name: 'Delta',
    created_at: '2026-03-04T00:00:00.000Z',
  },
  {
    id: 'agent-2',
    display_name: 'Beta',
    created_at: '2026-03-02T00:00:00.000Z',
  },
] as never[]

describe('left-rail agent display helpers', () => {
  it('sorts agents by created_at ascending', () => {
    expect(sortAgentsByCreatedAt(AGENTS).map((agent) => agent.id)).toEqual([
      'agent-1',
      'agent-2',
      'agent-3',
      'agent-4',
    ])
  })

  it('uses the earliest three agents by default', () => {
    expect(resolveLeftRailDisplayAgents(AGENTS, []).map((agent) => agent.id)).toEqual([
      'agent-1',
      'agent-2',
      'agent-3',
    ])
  })

  it('uses the edited selection when selected ids are present', () => {
    expect(resolveLeftRailDisplayAgents(AGENTS, ['agent-4', 'agent-2']).map((agent) => agent.id)).toEqual([
      'agent-2',
      'agent-4',
    ])
  })
})
