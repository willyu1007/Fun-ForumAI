import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useFeedViewStore, type FeedView } from '@/shared/stores/feed-view-store'
import type { FeedSortMode } from '@/shared/utils/feed-sort'
import { cn } from '@/lib/utils'

export type SortMode = FeedSortMode
interface FeedToolbarProps {
  sort: SortMode
  onSortChange: (sort: SortMode) => void
  followingOnly?: boolean
  onFollowingOnlyChange?: (value: boolean) => void
  showFollowingOnlyToggle?: boolean
  showSortControls?: boolean
  showViewControls?: boolean
  className?: string
}
export function FeedToolbar({
  sort,
  onSortChange,
  followingOnly = false,
  onFollowingOnlyChange,
  showFollowingOnlyToggle = false,
  showSortControls = true,
  showViewControls = true,
  className,
}: FeedToolbarProps) {
  const { view, setView } = useFeedViewStore()
  if (!showSortControls && !showViewControls && !showFollowingOnlyToggle) {
    return null
  }
  return (
    <div className={cn("flex flex-col gap-2 rounded-md border bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:py-1.5", className)}>
      {showSortControls ? (
        <Tabs value={sort} onValueChange={(v) => onSortChange(v as SortMode)}>
          <TabsList className={"h-8 w-full justify-start bg-transparent p-0"}>
            <TabsTrigger value="hot" className={"h-7 px-3 text-xs"}>
              🔥 热门
            </TabsTrigger>
            <TabsTrigger value="new" className={"h-7 px-3 text-xs"}>
              🕐 最新
            </TabsTrigger>
            <TabsTrigger value="top" className={"h-7 px-3 text-xs"}>
              ⬆ 高赞
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-2 self-end sm:self-auto">
        {showFollowingOnlyToggle && (
          <button
            type="button"
            className={`${"inline-flex h-7 items-center rounded-md border px-2 text-xs transition-colors"} ${
              followingOnly ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onFollowingOnlyChange?.(!followingOnly)}
          >
            👥 仅关注
          </button>
        )}

        {showViewControls && (
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
                <ToggleGroupItem value="card" className={"h-7 w-7 p-0 text-sm"} aria-label="卡片视图">
                  ▦
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={"text-xs"}>
                卡片视图
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="compact"
                  className={"h-7 w-7 p-0 text-sm"}
                  aria-label="紧凑视图"
                >
                  ≡
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={"text-xs"}>
                紧凑视图
              </TooltipContent>
            </Tooltip>
          </ToggleGroup>
        )}
      </div>
    </div>
  )
}
