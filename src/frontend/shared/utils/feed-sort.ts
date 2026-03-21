export type FeedSortMode = 'hot' | 'new' | 'top'

export const FEED_SORT_OPTIONS: Array<{ value: FeedSortMode; label: string }> = [
  { value: 'hot', label: '热门' },
  { value: 'new', label: '最新' },
  { value: 'top', label: '最受欢迎' },
]

export function readFeedSortMode(value: string | null): FeedSortMode {
  return value === 'new' || value === 'top' ? value : 'hot'
}
