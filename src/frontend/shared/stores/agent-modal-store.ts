import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  parseAgentTarget,
  type AgentIntroSection,
  type AgentTargetMode,
  type AgentTargetTab,
} from '../../../shared/agent-target.js'

export type AgentModalTab = AgentTargetTab
export interface AgentModalRect {
  x: number
  y: number
  w: number
  h: number
}

export interface AgentModalState {
  isOpen: boolean
  isCaptureHidden: boolean
  activeAgentId: string | null
  viewMode: AgentTargetMode
  activeTab: AgentModalTab
  introSection: AgentIntroSection | null
  sourceSessionId: string | null
  lastModalRect: AgentModalRect | null

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
  setLastModalRect: (rect: AgentModalRect) => void
}

export const useAgentModalStore = create<AgentModalState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      isCaptureHidden: false,
      activeAgentId: null,
      viewMode: 'readonly',
      activeTab: 'intro',
      introSection: null,
      sourceSessionId: null,
      lastModalRect: null,

      openModal: (agentId, mode, tab = 'intro', opts) =>
        set(() => {
          const currentState = get()
          const canRestoreLastContext =
            agentId == null
            && tab === 'chat'
            && !opts?.introSection
            && !opts?.sourceSessionId
            && currentState.activeAgentId != null

          return {
            isOpen: true,
            isCaptureHidden: false,
            activeAgentId: canRestoreLastContext ? currentState.activeAgentId : agentId,
            viewMode: mode,
            activeTab: canRestoreLastContext ? currentState.activeTab : tab,
            introSection: canRestoreLastContext ? currentState.introSection : (opts?.introSection ?? null),
            sourceSessionId: opts?.sourceSessionId ?? null,
          }
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

      setLastModalRect: (rect) =>
        set({
          lastModalRect: rect,
        }),
    }),
    {
      name: 'agent-modal-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeAgentId: state.activeAgentId,
        activeTab: state.activeTab,
        introSection: state.introSection,
        viewMode: state.viewMode,
        lastModalRect: state.lastModalRect,
      }),
    },
  ),
)

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
