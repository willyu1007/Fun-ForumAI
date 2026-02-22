import { create } from 'zustand'

interface SidebarState {
  leftOpen: boolean
  toggleLeft: () => void
  setLeftOpen: (open: boolean) => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  leftOpen: true,
  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
  setLeftOpen: (open) => set({ leftOpen: open }),
}))
