import { beforeEach, describe, expect, it } from 'vitest'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import {
  openMyAgentsWorkspace,
  openSpecificAgentInLastContext,
} from '../agent-modal-entry'

function resetAgentModalState() {
  useAgentModalStore.setState({
    isOpen: false,
    isCaptureHidden: false,
    activeAgentId: null,
    viewMode: 'readonly',
    activeTab: 'intro',
    introSection: null,
    agentContextsById: {},
    sourceSessionId: null,
    sourceSurface: null,
    sourceShelf: null,
    sourcePosition: null,
    prefillMessage: null,
    lastModalRect: null,
  })
}

describe('agent modal entry helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetAgentModalState()
  })

  it('restores the last workspace context for generic my-agents entrypoints', () => {
    useAgentModalStore.setState({
      activeAgentId: 'agent-last',
      activeTab: 'history',
      viewMode: 'readonly',
    })

    openMyAgentsWorkspace()

    const state = useAgentModalStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.viewMode).toBe('manage')
    expect(state.activeAgentId).toBe('agent-last')
    expect(state.activeTab).toBe('history')
  })

  it('defaults a specific agent entrypoint to chat when there is no prior agent context', () => {
    useAgentModalStore.setState({
      activeAgentId: 'agent-other',
      activeTab: 'history',
      viewMode: 'manage',
    })

    openSpecificAgentInLastContext('agent-alpha')

    const state = useAgentModalStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.viewMode).toBe('manage')
    expect(state.activeAgentId).toBe('agent-alpha')
    expect(state.activeTab).toBe('chat')
    expect(state.introSection).toBeNull()
  })

  it('inherits the last active tab when opening a specific agent', () => {
    useAgentModalStore.setState({
      agentContextsById: {
        'agent-beta': {
          tab: 'social',
          introSection: null,
        },
      },
    })

    openSpecificAgentInLastContext('agent-beta')

    const state = useAgentModalStore.getState()
    expect(state.activeAgentId).toBe('agent-beta')
    expect(state.activeTab).toBe('social')
    expect(state.introSection).toBeNull()
  })

  it('inherits the last intro section when the prior context was intro', () => {
    useAgentModalStore.setState({
      agentContextsById: {
        'agent-gamma': {
          tab: 'intro',
          introSection: 'privacy',
        },
      },
    })

    openSpecificAgentInLastContext('agent-gamma')

    const state = useAgentModalStore.getState()
    expect(state.activeAgentId).toBe('agent-gamma')
    expect(state.activeTab).toBe('intro')
    expect(state.introSection).toBe('privacy')
  })

  it('restores a specific agent last context when switching via store action', () => {
    useAgentModalStore.setState({
      agentContextsById: {
        'agent-zeta': {
          tab: 'moments',
          introSection: 'stats',
        },
      },
    })

    useAgentModalStore.getState().setActiveAgent('agent-zeta')

    const state = useAgentModalStore.getState()
    expect(state.activeAgentId).toBe('agent-zeta')
    expect(state.activeTab).toBe('moments')
    expect(state.introSection).toBe('stats')
  })
})
