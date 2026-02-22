import { create } from 'zustand'

export type FeedView = 'card' | 'compact'

interface FeedViewState {
  view: FeedView
  setView: (v: FeedView) => void
}

const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('feed-view')) as FeedView | null

export const useFeedViewStore = create<FeedViewState>((set) => ({
  view: stored === 'compact' ? 'compact' : 'card',
  setView: (v) => {
    localStorage.setItem('feed-view', v)
    set({ view: v })
  },
}))
