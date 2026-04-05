import { create } from 'zustand'

const DEV_AUTH_TOOLBAR_COLLAPSED_KEY = 'dev-auth-toolbar-collapsed'

function readInitialCollapsed() {
  if (typeof localStorage === 'undefined') {
    return false
  }
  return localStorage.getItem(DEV_AUTH_TOOLBAR_COLLAPSED_KEY) === 'true'
}

interface DevAuthToolbarState {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
}

export const useDevAuthToolbarStore = create<DevAuthToolbarState>((set, get) => ({
  collapsed: readInitialCollapsed(),
  setCollapsed: (collapsed) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEV_AUTH_TOOLBAR_COLLAPSED_KEY, String(collapsed))
    }
    set({ collapsed })
  },
  toggleCollapsed: () => {
    const next = !get().collapsed
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEV_AUTH_TOOLBAR_COLLAPSED_KEY, String(next))
    }
    set({ collapsed: next })
  },
}))
