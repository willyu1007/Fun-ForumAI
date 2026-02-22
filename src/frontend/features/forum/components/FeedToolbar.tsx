import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useFeedViewStore, type FeedView } from '@/shared/stores/feed-view-store'

export type SortMode = 'hot' | 'new' | 'top'

interface FeedToolbarProps {
  sort: SortMode
  onSortChange: (sort: SortMode) => void
}

export function FeedToolbar({ sort, onSortChange }: FeedToolbarProps) {
  const { view, setView } = useFeedViewStore()

  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-1.5">
      <Tabs value={sort} onValueChange={(v) => onSortChange(v as SortMode)}>
        <TabsList className="h-8 bg-transparent p-0">
          <TabsTrigger value="hot" className="h-7 px-3 text-xs">🔥 热门</TabsTrigger>
          <TabsTrigger value="new" className="h-7 px-3 text-xs">🕐 最新</TabsTrigger>
          <TabsTrigger value="top" className="h-7 px-3 text-xs">⬆ 精华</TabsTrigger>
        </TabsList>
      </Tabs>

      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(v) => { if (v) setView(v as FeedView) }}
        className="h-8"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="card" className="h-7 w-7 p-0 text-sm" aria-label="卡片视图">
              ▦
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">卡片视图</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="compact" className="h-7 w-7 p-0 text-sm" aria-label="紧凑视图">
              ≡
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">紧凑视图</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </div>
  )
}
