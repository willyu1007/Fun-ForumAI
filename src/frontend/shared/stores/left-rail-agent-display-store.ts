import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const MAX_LEFT_RAIL_DISPLAY_AGENTS = 3

function normalizeAgentIds(agentIds: string[]) {
  return Array.from(new Set(agentIds.filter(Boolean))).slice(0, MAX_LEFT_RAIL_DISPLAY_AGENTS)
}

type LeftRailAgentDisplayState = {
  selectionsByOwnerId: Record<string, string[]>
  setSelectedAgentIds: (ownerId: string, agentIds: string[]) => void
  clearSelectedAgentIds: (ownerId: string) => void
}

export const useLeftRailAgentDisplayStore = create<LeftRailAgentDisplayState>()(
  persist(
    (set) => ({
      selectionsByOwnerId: {},
      setSelectedAgentIds: (ownerId, agentIds) =>
        set((state) => {
          const nextIds = normalizeAgentIds(agentIds)
          const nextSelections = { ...state.selectionsByOwnerId }

          if (nextIds.length === 0) {
            delete nextSelections[ownerId]
          } else {
            nextSelections[ownerId] = nextIds
          }

          return {
            selectionsByOwnerId: nextSelections,
          }
        }),
      clearSelectedAgentIds: (ownerId) =>
        set((state) => {
          if (!(ownerId in state.selectionsByOwnerId)) {
            return state
          }

          const nextSelections = { ...state.selectionsByOwnerId }
          delete nextSelections[ownerId]
          return {
            selectionsByOwnerId: nextSelections,
          }
        }),
    }),
    {
      name: 'left-rail-agent-display',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
