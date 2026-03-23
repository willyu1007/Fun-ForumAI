import { create } from 'zustand'

export type AgentModalTab = 'intro' | 'chat' | 'moments' | 'history' | 'social'

export interface AgentModalState {
  isOpen: boolean
  activeAgentId: string | null
  viewMode: 'manage' | 'readonly'
  activeTab: AgentModalTab

  openModal: (agentId: string | null, mode: 'manage' | 'readonly', tab?: AgentModalTab) => void
  closeModal: () => void
  setActiveTab: (tab: AgentModalTab) => void
  setActiveAgent: (agentId: string | null) => void
}

export const useAgentModalStore = create<AgentModalState>((set) => ({
  isOpen: false,
  activeAgentId: null,
  viewMode: 'readonly',
  activeTab: 'intro',

  openModal: (agentId, mode, tab = 'intro') =>
    set({
      isOpen: true,
      activeAgentId: agentId,
      viewMode: mode,
      activeTab: tab,
    }),

  closeModal: () =>
    set({
      isOpen: false,
      // We don't clear activeAgentId immediately so the modal can animate out smoothly
    }),

  setActiveTab: (tab) =>
    set({
      activeTab: tab,
    }),

  setActiveAgent: (agentId) =>
    set({
      activeAgentId: agentId,
    }),
}))

const AGENT_PATH_RE = /^\/agents\/([^/]+)(?:\/(\w+))?/

function parseAgentUrl(url: string): { agentId: string; tab: AgentModalTab } | null {
  const match = AGENT_PATH_RE.exec(url)
  if (!match) return null
  const agentId = match[1]
  const segment = match[2]
  const tab: AgentModalTab = segment === 'chat' ? 'chat' : 'intro'
  return { agentId, tab }
}

/**
 * If `url` points to an agent route, open the modal and return `true`.
 * Otherwise return `false` so the caller can fall back to normal navigation.
 */
export function tryOpenAgentModal(
  url: string,
  mode: 'manage' | 'readonly' = 'readonly',
): boolean {
  const parsed = parseAgentUrl(url)
  if (!parsed) return false
  useAgentModalStore.getState().openModal(parsed.agentId, mode, parsed.tab)
  return true
}
