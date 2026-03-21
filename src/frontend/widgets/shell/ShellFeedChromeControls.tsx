import { useLocation, useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, LayoutGrid, Rows3 } from 'lucide-react'
import { useAuth } from '@/shared/hooks/use-auth'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import {
  FEED_SORT_OPTIONS,
  readFeedSortMode,
  type FeedSortMode,
} from '@/shared/utils/feed-sort'
import { cn } from '@/lib/utils'

const VIEW_OPTIONS = [
  { value: 'card', label: '卡片', icon: LayoutGrid },
  { value: 'compact', label: '紧凑', icon: Rows3 },
] as const

function isFeedScopedPath(pathname: string) {
  return pathname === '/' || pathname.startsWith('/c/')
}

export function ShellFeedChromeControls() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const { view, setView } = useFeedViewStore()

  if (!isFeedScopedPath(location.pathname)) {
    return null
  }

  const searchParams = new URLSearchParams(location.search)
  const currentSort = readFeedSortMode(searchParams.get('sort'))
  const currentView = VIEW_OPTIONS.find((option) => option.value === view) ?? VIEW_OPTIONS[0]

  const updateSort = (nextSort: FeedSortMode) => {
    const next = new URLSearchParams(location.search)
    if (nextSort === 'hot') {
      next.delete('sort')
    } else {
      next.set('sort', nextSort)
    }
    const nextSearch = next.toString()
    void navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    )
  }

  return (
    <div className="hidden shrink-0 items-center gap-0.75 md:flex">
      {isAuthenticated && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-md px-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-0"
              aria-label={`当前排序：${FEED_SORT_OPTIONS.find((option) => option.value === currentSort)?.label ?? '热门'}`}
            >
              {FEED_SORT_OPTIONS.find((option) => option.value === currentSort)?.label ?? '热门'}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-3xl p-1.5">
            <DropdownMenuLabel className="px-3 pt-2 pb-2 text-xs font-semibold text-muted-foreground">
              排序方式
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {FEED_SORT_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                className={cn(
                  'px-3 py-3 text-sm',
                  currentSort === option.value
                    ? 'bg-muted font-semibold text-foreground'
                    : 'text-foreground',
                )}
                onClick={() => updateSort(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
              type="button"
              className={cn(
                'inline-flex h-7 items-center rounded-md px-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-0',
                'gap-0.5',
              )}
              aria-label={`阅读模式：${currentView.label}`}
              title={`阅读模式：${currentView.label}`}
            >
              <currentView.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-3xl p-1.5">
          <DropdownMenuLabel className="px-3 pt-2 pb-2 text-xs font-semibold text-muted-foreground">
            查看
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <DropdownMenuItem
                key={option.value}
                className={cn(
                  'px-3 py-3 text-sm',
                  view === option.value
                    ? 'bg-muted font-semibold text-foreground'
                    : 'text-foreground',
                )}
                onClick={() => setView(option.value)}
              >
                <Icon className="mr-3 h-4 w-4 text-muted-foreground" />
                {option.label}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
