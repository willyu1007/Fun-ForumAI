import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import type { AgentIntroSection, AgentTargetTab } from '@/shared/utils/agent-target'

type OpenModalFn = ReturnType<typeof useAgentModalStore.getState>['openModal']

function readAgentModalState():
  | ReturnType<typeof useAgentModalStore.getState>
  | { agentContextsById: Record<string, { tab: AgentTargetTab; introSection: AgentIntroSection | null }> } {
  const store = useAgentModalStore as typeof useAgentModalStore & {
    getState?: () => ReturnType<typeof useAgentModalStore.getState>
  }

  if (typeof store.getState === 'function') {
    return store.getState()
  }

  return {
    agentContextsById: {},
  }
}

function resolveAgentSpecificContext(agentId: string): {
  tab: AgentTargetTab
  introSection: AgentIntroSection | null
} {
  const state = readAgentModalState()
  const context = state.agentContextsById[agentId]

  if (!context) {
    return {
      tab: 'chat',
      introSection: null,
    }
  }

  return {
    tab: context.tab,
    introSection: context.introSection,
  }
}

export function openMyAgentsWorkspace(): void {
  useAgentModalStore.getState().openModal(null, 'manage', 'chat')
}

export function openSpecificAgentInLastContext(
  agentId: string,
  openModal?: OpenModalFn,
): void {
  const context = resolveAgentSpecificContext(agentId)
  const resolvedOpenModal = openModal ?? useAgentModalStore.getState().openModal

  resolvedOpenModal(
    agentId,
    'manage',
    context.tab,
    context.tab === 'intro'
      ? { introSection: context.introSection }
      : undefined,
  )
}
