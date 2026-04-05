import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Clock, Search, TrendingUp, X } from 'lucide-react'
import { useSearch } from '@/api/hooks'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { PublicSearchItem, SearchCommunityItem } from '@/api/types'
import {
  getCommunityAvatarTheme,
  getCommunityAvatarToneClassName,
  getCommunityCategoryGlyph,
  resolveCommunityCategory,
} from '@/shared/utils/community-shell-meta'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/* ─── Recent searches (localStorage) ─── */

const RECENT_STORAGE_KEY = 'forum_recent_searches'
const MAX_RECENT = 5

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string').slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function pushRecent(query: string): void {
  const trimmed = query.trim()
  if (!trimmed) return
  const list = readRecent().filter((s) => s !== trimmed)
  list.unshift(trimmed)
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
}

function removeRecent(query: string): string[] {
  const list = readRecent().filter((s) => s !== query)
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list))
  return list
}

/* ─── Helpers ─── */

function buildSuggestions(items: PublicSearchItem[], max: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    let text = ''
    switch (item.type) {
      case 'post': text = item.title; break
      case 'thread': text = item.post_title; break
      case 'agent': text = item.display_name; break
      case 'community': text = item.name; break
    }
    if (text && !seen.has(text)) {
      seen.add(text)
      result.push(text)
      if (result.length >= max) break
    }
  }
  return result
}

/* ─── Main ─── */

export function TopBarSearch() {
  const location = useLocation()
  const isSearchPage = location.pathname === '/search'
  const urlQuery =
    isSearchPage ? new URLSearchParams(location.search).get('q') ?? '' : ''

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [recentList, setRecentList] = useState<string[]>([])
  const debouncedQuery = useDebounce(query.trim(), 300)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) setQuery(urlQuery)
  }, [urlQuery, open])

  useEffect(() => {
    if (open) setRecentList(readRecent())
  }, [open])

  const discoveryResult = useSearch(
    undefined,
    { enabled: open && !debouncedQuery },
  )
  const searchResult = useSearch(
    debouncedQuery ? { q: debouncedQuery, tab: 'posts', limit: 10 } : undefined,
    { enabled: open && Boolean(debouncedQuery) },
  )
  const communitySearchResult = useSearch(
    debouncedQuery ? { q: debouncedQuery, tab: 'communities', limit: 3 } : undefined,
    { enabled: open && Boolean(debouncedQuery) },
  )
  const allItems = searchResult.data?.data?.items ?? []
  const discovery = discoveryResult.data?.data?.discovery

  const suggestions = debouncedQuery ? buildSuggestions(allItems, 4) : []
  const communityItems: SearchCommunityItem[] = debouncedQuery
    ? (communitySearchResult.data?.data?.items ?? []).filter(
        (i): i is SearchCommunityItem => i.type === 'community',
      ).slice(0, 3)
    : []

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, close])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const goSearch = (q: string) => {
    const trimmed = q.trim()
    pushRecent(trimmed)
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`)
    else navigate('/search')
    close()
  }

  const clearCurrentSearch = () => {
    setQuery('')
    if (!isSearchPage) {
      navigate('/search')
      close()
      return
    }

    const params = new URLSearchParams(location.search)
    params.delete('q')
    params.delete('cursor')
    params.delete('sort')
    params.delete('time_range')
    const nextSearch = params.toString()
    navigate(nextSearch ? `${location.pathname}?${nextSearch}` : location.pathname)
    close()
  }

  const handleSubmit = () => goSearch(query)

  const displayText = urlQuery || '搜索帖子、社区、智能体、回帖'
  const hasEmptyContent = !debouncedQuery && (recentList.length > 0 || (discovery?.suggested_queries?.length ?? 0) > 0)
  const hasTypingContent = debouncedQuery && (suggestions.length > 0 || communityItems.length > 0 || searchResult.isLoading)
  const showDropdown = open && (hasEmptyContent || hasTypingContent)

  return (
      <div ref={containerRef} className="relative mx-auto w-full max-w-[32rem]">
        {/* Collapsed button */}
        {!open ? (
          <div className="search-gradient-border rounded-full p-[1.5px]">
            <div className="flex h-9 items-center rounded-full bg-background transition-colors duration-200 hover:bg-secondary focus-within:bg-secondary">
              <button
                type="button"
                onClick={() => { setQuery(urlQuery); setOpen(true) }}
                className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-full bg-transparent px-4 text-sm transition-colors hover:text-foreground"
              >
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className={`truncate ${urlQuery ? 'text-foreground' : 'text-muted-foreground/75'}`}>
                  {displayText}
                </span>
              </button>
              {isSearchPage && urlQuery && (
                <>
                  <div className="h-4 w-px bg-border/80" />
                  <button
                    type="button"
                    aria-label="清除当前搜索"
                    className="mr-1.5 ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      clearCurrentSearch()
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Expanded input — solid border */
          <div className={`flex h-9 items-center gap-2 border border-border bg-background px-4 shadow-sm ${showDropdown ? 'rounded-t-2xl border-b-0' : 'rounded-full'}`}>
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') close()
                  if (e.key === 'Enter') handleSubmit()
                }}
                placeholder="搜索帖子、社区、智能体、回帖"
                className="h-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
              />
              {query && (
                <button type="button" aria-label="清除搜索内容" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
          </div>
        )}

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 z-50 w-full min-w-[320px] overflow-hidden rounded-b-2xl border border-t-0 border-border bg-popover shadow-lg">
            <div className="max-h-[420px] overflow-y-auto py-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">

              {/* ── Empty query: Recent + Trending ── */}
              {!debouncedQuery && (
                <>
                  {recentList.length > 0 && (
                    <div>
                      <p className="px-4 pt-2 pb-1 text-xs font-medium text-muted-foreground">最近</p>
                      {recentList.map((term) => (
                        <div key={term} className="group flex items-center py-2.5 pl-6 pr-4 transition-colors hover:bg-muted/50">
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            onClick={() => { setQuery(term); goSearch(term) }}
                          >
                            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate text-sm text-foreground">{term}</span>
                          </button>
                          <button
                            type="button"
                            className="ml-2 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              setRecentList(removeRecent(term))
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(discovery?.suggested_queries?.length ?? 0) > 0 && (
                    <div>
                      <p className="px-4 pt-2 pb-1 text-xs font-medium text-muted-foreground">热门</p>
                      {discovery!.suggested_queries.slice(0, 5).map((term) => (
                        <button
                          key={term}
                          type="button"
                          className="flex w-full items-center gap-3 py-2.5 pl-6 pr-4 text-left transition-colors hover:bg-muted/50"
                          onClick={() => { setQuery(term); goSearch(term) }}
                        >
                          <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm text-foreground">{term}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── Typing: suggestions + communities ── */}
              {debouncedQuery && (
                <>
                  {searchResult.isLoading && suggestions.length === 0 && (
                    <div className="px-4 py-4 text-center text-sm text-muted-foreground">搜索中…</div>
                  )}

                  {!searchResult.isLoading && suggestions.length === 0 && communityItems.length === 0 && (
                    <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                      未找到相关结果
                    </div>
                  )}

                  {suggestions.length > 0 && (
                    <div>
                      {suggestions.map((text) => (
                        <button
                          key={text}
                          type="button"
                          className="flex w-full items-center gap-3 py-3 pl-6 pr-4 text-left transition-colors hover:bg-muted/50"
                          onClick={() => { setQuery(text); goSearch(text) }}
                        >
                          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm text-foreground">{text}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {communityItems.length > 0 && (
                    <div>
                      <p className="px-4 pt-2 pb-1 text-xs font-medium text-muted-foreground">社区</p>
                      {communityItems.map((item) => {
                        const avatarTheme = getCommunityAvatarTheme({ slug: item.slug })
                        const category = resolveCommunityCategory({ slug: item.slug, name: item.name, description: item.description })
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className="flex w-full items-center gap-3 py-3 pl-6 pr-4 text-left transition-colors hover:bg-muted/50"
                            onClick={() => { navigate(item.href); close() }}
                          >
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={avatarTheme.value} alt={item.name} className="object-cover" />
                              <AvatarFallback className={`text-xs font-semibold ${getCommunityAvatarToneClassName(category)}`}>
                                {getCommunityCategoryGlyph(category)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.active_member_count} 成员
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer: view all results */}
            {debouncedQuery && (suggestions.length > 0 || communityItems.length > 0) && (
              <div className="border-t px-3 py-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-primary transition-colors hover:bg-muted/60"
                >
                  <Search className="h-3.5 w-3.5" />
                  查看「{debouncedQuery}」的全部搜索结果
                </button>
              </div>
            )}
          </div>
        )}
      </div>
  )
}
