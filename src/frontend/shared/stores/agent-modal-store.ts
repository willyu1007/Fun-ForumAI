import { create } from 'zustand'
import {
  parseAgentTarget,
  type AgentIntroSection,
  type AgentTargetMode,
  type AgentTargetTab,
} from '../../../shared/agent-target.js'

export type AgentModalTab = AgentTargetTab

export interface AgentModalState {
  isOpen: boolean
  isCaptureHidden: boolean
  activeAgentId: string | null
  viewMode: AgentTargetMode
  activeTab: AgentModalTab
  introSection: AgentIntroSection | null
  sourceSessionId: string | null

  openModal: (
    agentId: string | null,
    mode: AgentTargetMode,
    tab?: AgentModalTab,
    opts?: {
      introSection?: AgentIntroSection | null
      sourceSessionId?: string | null
    },
  ) => void
  closeModal: () => void
  hideForCapture: () => void
  showAfterCapture: () => void
  setActiveTab: (tab: AgentModalTab) => void
  setActiveAgent: (agentId: string | null) => void
}

export const useAgentModalStore = create<AgentModalState>((set) => ({
  isOpen: false,
  isCaptureHidden: false,
  activeAgentId: null,
  viewMode: 'readonly',
  activeTab: 'intro',
  introSection: null,
  sourceSessionId: null,

  openModal: (agentId, mode, tab = 'intro', opts) =>
    set({
      isOpen: true,
      isCaptureHidden: false,
      activeAgentId: agentId,
      viewMode: mode,
      activeTab: tab,
      introSection: opts?.introSection ?? null,
      sourceSessionId: opts?.sourceSessionId ?? null,
    }),

  closeModal: () =>
    set({
      isOpen: false,
      isCaptureHidden: false,
      // We don't clear activeAgentId immediately so the modal can animate out smoothly
    }),

  hideForCapture: () =>
    set({
      isCaptureHidden: true,
    }),

  showAfterCapture: () =>
    set({
      isCaptureHidden: false,
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

/**
 * If `url` points to an agent route, open the modal and return `true`.
 * Otherwise return `false` so the caller can fall back to normal navigation.
 */
export function tryOpenAgentModal(
  url: string,
  mode: AgentTargetMode = 'readonly',
): boolean {
  const parsed = parseAgentTarget(url)
  if (!parsed) return false
  if (parsed.kind === 'manage') {
    useAgentModalStore.getState().openModal(null, parsed.mode ?? mode, 'intro')
    return true
  }

  useAgentModalStore.getState().openModal(
    parsed.agentId,
    parsed.mode ?? mode,
    parsed.tab ?? 'intro',
    {
      introSection: parsed.introSection ?? null,
      sourceSessionId: parsed.sourceSessionId ?? null,
    },
  )
  return true
}
