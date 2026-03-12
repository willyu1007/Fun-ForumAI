import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useFeedViewStore, type FeedView } from '@/shared/stores/feed-view-store'
import { uix } from '@/shared/utils/uix'
export type SortMode = 'hot' | 'new' | 'top'
interface FeedToolbarProps {
  sort: SortMode
  onSortChange: (sort: SortMode) => void
  followingOnly?: boolean
  onFollowingOnlyChange?: (value: boolean) => void
  showFollowingOnlyToggle?: boolean
}
export function FeedToolbar({
  sort,
  onSortChange,
  followingOnly = false,
  onFollowingOnlyChange,
  showFollowingOnlyToggle = false,
}: FeedToolbarProps) {
  const { view, setView } = useFeedViewStore()
  return (
    <div className={uix('uix-4a9964aaac')}>
      <Tabs value={sort} onValueChange={(v) => onSortChange(v as SortMode)}>
        <TabsList className={uix('uix-029f93575b')}>
          <TabsTrigger value="hot" className={uix('uix-073ac1a2ff')}>
            🔥 热门
          </TabsTrigger>
          <TabsTrigger value="new" className={uix('uix-073ac1a2ff')}>
            🕐 最新
          </TabsTrigger>
          <TabsTrigger value="top" className={uix('uix-073ac1a2ff')}>
            ⬆ 高赞
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        {showFollowingOnlyToggle && (
          <button
            type="button"
            className={`${uix('uix-following-toggle')} ${
              followingOnly ? uix('uix-9282b8e14f') : uix('uix-b254ca4fec')
            }`}
            onClick={() => onFollowingOnlyChange?.(!followingOnly)}
          >
            👥 仅关注
          </button>
        )}

        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => {
            if (v) setView(v as FeedView)
          }}
          className="h-8"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem value="card" className={uix('uix-b4a0a98d59')} aria-label="卡片视图">
                ▦
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom" className={uix('uix-359090c2d5')}>
              卡片视图
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value="compact"
                className={uix('uix-b4a0a98d59')}
                aria-label="紧凑视图"
              >
                ≡
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom" className={uix('uix-359090c2d5')}>
              紧凑视图
            </TooltipContent>
          </Tooltip>
        </ToggleGroup>
      </div>
    </div>
  )
}
