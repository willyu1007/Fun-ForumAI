import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  parseAgentTarget,
  type AgentIntroSection,
  type AgentTargetMode,
  type AgentTargetTab,
} from '../../../shared/agent-target.js'

export type AgentModalTab = AgentTargetTab
export interface AgentModalAgentContext {
  tab: AgentModalTab
  introSection: AgentIntroSection | null
}
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
  agentContextsById: Record<string, AgentModalAgentContext>
  sourceSessionId: string | null
  sourceSurface: string | null
  sourceShelf: string | null
  sourcePosition: number | null
  prefillMessage: string | null
  pendingCreateWizard: boolean
  lastModalRect: AgentModalRect | null

  openModal: (
    agentId: string | null,
    mode: AgentTargetMode,
    tab?: AgentModalTab,
    opts?: {
      introSection?: AgentIntroSection | null
      sourceSessionId?: string | null
      sourceSurface?: string | null
      sourceShelf?: string | null
      sourcePosition?: number | null
      prefillMessage?: string | null
    },
  ) => void
  closeModal: () => void
  hideForCapture: () => void
  showAfterCapture: () => void
  setActiveTab: (tab: AgentModalTab) => void
  setIntroSection: (introSection: AgentIntroSection | null) => void
  setActiveAgent: (agentId: string | null) => void
  setLastModalRect: (rect: AgentModalRect) => void
  setPendingCreateWizard: (pending: boolean) => void
}

function getAgentContext(
  contextsById: Record<string, AgentModalAgentContext>,
  agentId: string,
): AgentModalAgentContext {
  return contextsById[agentId] ?? {
    tab: 'chat',
    introSection: null,
  }
}

function upsertAgentContext(
  contextsById: Record<string, AgentModalAgentContext>,
  agentId: string,
  context: AgentModalAgentContext,
) {
  return {
    ...contextsById,
    [agentId]: context,
  }
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
      agentContextsById: {},
      sourceSessionId: null,
      sourceSurface: null,
      sourceShelf: null,
      sourcePosition: null,
      prefillMessage: null,
      pendingCreateWizard: false,
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

          const nextAgentId = canRestoreLastContext ? currentState.activeAgentId : agentId
          const nextActiveTab = canRestoreLastContext ? currentState.activeTab : tab
          const existingContext = nextAgentId
            ? getAgentContext(currentState.agentContextsById, nextAgentId)
            : null
          const nextIntroSection = canRestoreLastContext
            ? currentState.introSection
            : tab === 'intro'
              ? (opts?.introSection ?? existingContext?.introSection ?? null)
              : (existingContext?.introSection ?? null)

          return {
            isOpen: true,
            isCaptureHidden: false,
            activeAgentId: nextAgentId,
            viewMode: mode,
            activeTab: nextActiveTab,
            introSection: nextIntroSection,
            agentContextsById: nextAgentId
              ? upsertAgentContext(currentState.agentContextsById, nextAgentId, {
                  tab: nextActiveTab,
                  introSection: nextIntroSection,
                })
              : currentState.agentContextsById,
            sourceSessionId: opts?.sourceSessionId ?? null,
            sourceSurface: opts?.sourceSurface ?? null,
            sourceShelf: opts?.sourceShelf ?? null,
            sourcePosition: opts?.sourcePosition ?? null,
            prefillMessage: opts?.prefillMessage ?? null,
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
        set((state) => {
          if (!state.activeAgentId) {
            return {
              activeTab: tab,
            }
          }

          const existingContext = getAgentContext(state.agentContextsById, state.activeAgentId)
          return {
            activeTab: tab,
            introSection: existingContext.introSection,
            agentContextsById: upsertAgentContext(state.agentContextsById, state.activeAgentId, {
              tab,
              introSection: existingContext.introSection,
            }),
          }
        }),

      setIntroSection: (introSection) =>
        set((state) => {
          if (!state.activeAgentId) {
            return {
              introSection,
            }
          }

          const existingContext = getAgentContext(state.agentContextsById, state.activeAgentId)
          return {
            introSection,
            agentContextsById: upsertAgentContext(state.agentContextsById, state.activeAgentId, {
              tab: state.activeTab === 'intro' ? 'intro' : existingContext.tab,
              introSection,
            }),
          }
        }),

      setActiveAgent: (agentId) =>
        set((state) => {
          if (!agentId) {
            return {
              activeAgentId: null,
            }
          }

          const nextContext = getAgentContext(state.agentContextsById, agentId)
          return {
            activeAgentId: agentId,
            activeTab: nextContext.tab,
            introSection: nextContext.introSection,
            agentContextsById: upsertAgentContext(state.agentContextsById, agentId, nextContext),
          }
        }),

      setLastModalRect: (rect) =>
        set({
          lastModalRect: rect,
        }),

      setPendingCreateWizard: (pending) =>
        set({
          pendingCreateWizard: pending,
        }),
    }),
    {
      name: 'agent-modal-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeAgentId: state.activeAgentId,
        activeTab: state.activeTab,
        introSection: state.introSection,
        agentContextsById: state.agentContextsById,
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
