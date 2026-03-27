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

const SEARCH_SORT_OPTIONS = [
  { value: 'relevance', label: '相关性' },
  { value: 'new', label: '最新' },
  { value: 'hot', label: '热度' },
] as const

const SEARCH_TIME_RANGE_OPTIONS = [
  { value: 'all', label: '所有时间' },
  { value: 'year', label: '去年' },
  { value: 'month', label: '上个月' },
  { value: 'week', label: '上周' },
  { value: 'day', label: '今天' },
  { value: 'hour', label: '过去1小时' },
] as const

function isFeedScopedPath(pathname: string) {
  return pathname === '/' || pathname.startsWith('/c/')
}

function isSearchPage(pathname: string) {
  return pathname === '/search'
}

function SearchChromeControls() {
  const navigate = useNavigate()
  const location = useLocation()

  const searchParams = new URLSearchParams(location.search)
  const currentSort = searchParams.get('sort') ?? 'relevance'
  const currentTimeRange = searchParams.get('time_range') ?? 'all'

  const updateParam = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(location.search)
    if (value === defaultValue) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    const nextSearch = next.toString()
    void navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
      { replace: true },
    )
  }

  const sortLabel = SEARCH_SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? '相关性'
  const timeLabel = SEARCH_TIME_RANGE_OPTIONS.find((o) => o.value === currentTimeRange)?.label ?? '所有时间'

  return (
    <div className="hidden shrink-0 items-center gap-0.75 md:flex">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-md px-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-0"
            aria-label={`当前排序：${sortLabel}`}
          >
            {sortLabel}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-3xl p-1.5">
          <DropdownMenuLabel className="px-3 pt-2 pb-2 text-xs font-semibold text-muted-foreground">
            排序方式
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SEARCH_SORT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              className={cn(
                'px-3 py-3 text-sm',
                currentSort === option.value
                  ? 'bg-muted font-semibold text-foreground'
                  : 'text-foreground',
              )}
              onClick={() => updateParam('sort', option.value, 'relevance')}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-md px-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-0"
            aria-label={`时间范围：${timeLabel}`}
          >
            {timeLabel}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 rounded-3xl p-1.5">
          <DropdownMenuLabel className="px-3 pt-2 pb-2 text-xs font-semibold text-muted-foreground">
            时间范围
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SEARCH_TIME_RANGE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              className={cn(
                'px-3 py-3 text-sm',
                currentTimeRange === option.value
                  ? 'bg-muted font-semibold text-foreground'
                  : 'text-foreground',
              )}
              onClick={() => updateParam('time_range', option.value, 'all')}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function FeedChromeControls() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const { view, setView } = useFeedViewStore()

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

export function ShellFeedChromeControls() {
  const location = useLocation()

  if (isSearchPage(location.pathname)) {
    return <SearchChromeControls />
  }

  if (isFeedScopedPath(location.pathname)) {
    return <FeedChromeControls />
  }

  return null
}
