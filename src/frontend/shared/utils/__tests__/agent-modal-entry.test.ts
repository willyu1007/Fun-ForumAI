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
      activeAgentId: null,
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

  it('inherits the current modal browsing tab when opening a specific agent', () => {
    useAgentModalStore.setState({
      activeAgentId: 'agent-last',
      activeTab: 'history',
      introSection: null,
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
    expect(state.activeTab).toBe('history')
    expect(state.introSection).toBeNull()
  })

  it('inherits the current intro section when the browsing context is intro', () => {
    useAgentModalStore.setState({
      activeAgentId: 'agent-last',
      activeTab: 'intro',
      introSection: 'privacy',
      agentContextsById: {
        'agent-gamma': {
          tab: 'social',
          introSection: null,
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

  it('keeps the current browsing context when switching agents inside the modal', () => {
    useAgentModalStore.setState({
      activeAgentId: 'agent-alpha',
      activeTab: 'history',
      introSection: 'privacy',
      agentContextsById: {
        'agent-beta': {
          tab: 'social',
          introSection: null,
        },
      },
    })

    useAgentModalStore.getState().switchActiveAgent('agent-beta')

    const state = useAgentModalStore.getState()
    expect(state.activeAgentId).toBe('agent-beta')
    expect(state.activeTab).toBe('history')
    expect(state.introSection).toBe('privacy')
    expect(state.agentContextsById['agent-beta']).toEqual({
      tab: 'history',
      introSection: 'privacy',
    })
  })

  it('lets explicit modal targets override the current browsing context', () => {
    useAgentModalStore.setState({
      activeAgentId: 'agent-alpha',
      activeTab: 'history',
      introSection: 'privacy',
    })

    useAgentModalStore.getState().openModal('agent-beta', 'readonly', 'chat')

    const state = useAgentModalStore.getState()
    expect(state.activeAgentId).toBe('agent-beta')
    expect(state.activeTab).toBe('chat')
    expect(state.introSection).toBeNull()
  })
})
