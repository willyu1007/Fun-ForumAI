import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFeedViewStore, type FeedView } from '@/shared/stores/feed-view-store'
import { FEED_SORT_OPTIONS, type FeedSortMode } from '@/shared/utils/feed-sort'
import { ChevronDown, LayoutGrid, Rows3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const VIEW_OPTIONS: Array<{ value: FeedView; label: string; icon: typeof LayoutGrid }> = [
  { value: 'card', label: '卡片', icon: LayoutGrid },
  { value: 'compact', label: '紧凑', icon: Rows3 },
]

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

  const sortLabel = FEED_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? '热门'
  const currentViewOption = VIEW_OPTIONS.find((o) => o.value === view) ?? VIEW_OPTIONS[0]
  const ViewIcon = currentViewOption.icon

  return (
    <div className={cn('flex items-center gap-1 px-[18px] pt-1.5', className)}>
      {showSortControls && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-muted-foreground/80 outline-none ring-0 transition-colors hover:bg-foreground/8 hover:text-foreground/90 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-foreground/8 data-[state=open]:text-foreground/90"
              aria-label={`当前排序：${sortLabel}`}
            >
              {sortLabel}
              <ChevronDown className="mt-px h-2.5 w-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuLabel className="text-xs text-muted-foreground">排序方式</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {FEED_SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                className={cn(
                  'text-sm',
                  sort === option.value && 'font-semibold text-foreground',
                )}
                onClick={() => onSortChange(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {showViewControls && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-muted-foreground/80 outline-none ring-0 transition-colors hover:bg-foreground/8 hover:text-foreground/90 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-foreground/8 data-[state=open]:text-foreground/90"
              aria-label={`阅读模式：${currentViewOption.label}`}
            >
              <ViewIcon className="h-3.5 w-3.5" />
              <ChevronDown className="mt-px h-2.5 w-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuLabel className="text-xs text-muted-foreground">查看</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {VIEW_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <DropdownMenuItem
                  key={option.value}
                  className={cn(
                    'text-sm',
                    view === option.value && 'font-semibold text-foreground',
                  )}
                  onClick={() => setView(option.value)}
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {option.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {showFollowingOnlyToggle && (
        <button
          type="button"
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none',
            followingOnly
              ? 'bg-primary/10 text-primary hover:bg-primary/15'
              : 'text-muted-foreground/80 hover:bg-foreground/8 hover:text-foreground/90',
          )}
          aria-pressed={followingOnly}
          onClick={() => onFollowingOnlyChange?.(!followingOnly)}
        >
          仅关注
        </button>
      )}
    </div>
  )
}
