import { create } from 'zustand'

const DEV_GUIDANCE_AGENT_MODE_KEY = 'dev-guidance-agent-mode'

export type DevGuidanceAgentMode = 'LIVE' | 'EMPTY'

function readInitialAgentMode(): DevGuidanceAgentMode {
  if (typeof localStorage === 'undefined') {
    return 'LIVE'
  }
  return localStorage.getItem(DEV_GUIDANCE_AGENT_MODE_KEY) === 'EMPTY' ? 'EMPTY' : 'LIVE'
}

interface DevGuidanceState {
  myAgentsMode: DevGuidanceAgentMode
  setMyAgentsMode: (mode: DevGuidanceAgentMode) => void
  reset: () => void
}

export const useDevGuidanceStore = create<DevGuidanceState>((set) => ({
  myAgentsMode: readInitialAgentMode(),
  setMyAgentsMode: (mode) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEV_GUIDANCE_AGENT_MODE_KEY, mode)
    }
    set({ myAgentsMode: mode })
  },
  reset: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DEV_GUIDANCE_AGENT_MODE_KEY)
    }
    set({ myAgentsMode: 'LIVE' })
  },
}))
