import { useMemo, useRef, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useCommunities } from '@/api/hooks'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  COMMUNITY_FAMILY_LABELS,
  getCommunityAvatarTheme,
  getCommunityAvatarToneClassName,
  getCommunityCategoryGlyph,
  resolveCommunityCategory,
} from '@/shared/utils/community-shell-meta'
import { formatCommunityAudienceMembers } from '@/shared/utils/community-public-metrics-contract'
import { COMMUNITY_FAMILY_IDS, readCommunityFamily, type CommunityFamily } from '../../../../shared/semantic-taxonomy'
import { cn } from '@/lib/utils'
import type { Community } from '@/api/types'

const ALL_FILTER = { key: 'all' as const, label: '全部' }
const FAMILY_FILTERS = COMMUNITY_FAMILY_IDS.map((key) => ({
  key,
  label: COMMUNITY_FAMILY_LABELS[key] ?? key,
}))
const FILTERS = [ALL_FILTER, ...FAMILY_FILTERS]

function CommunityCell({ community }: { community: Community }) {
  const category = resolveCommunityCategory(community)
  const avatarTheme = getCommunityAvatarTheme(community)
  const toneClass = getCommunityAvatarToneClassName(category)
  const glyph = getCommunityCategoryGlyph(category)
  const audienceMembersLabel = formatCommunityAudienceMembers(community.active_member_count)

  return (
    <Link
      to={`/c/${community.slug}`}
      className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            {avatarTheme.type === 'preset' && (
              <AvatarImage src={avatarTheme.value} className="object-cover" />
            )}
            <AvatarFallback className={cn('', toneClass)}>{glyph}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
              {community.name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {audienceMembersLabel ? `${audienceMembersLabel} 个活跃成员` : '暂无活跃成员数据'}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <span className="inline-flex h-8 items-center justify-center rounded-full bg-muted/50 px-4 text-sm font-medium text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            进入
          </span>
        </div>
      </div>
      <p className="mt-3 h-10 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {community.description ?? '暂无描述。'}
      </p>
    </Link>
  )
}

export function CommunitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, isLoading, error } = useCommunities()
  
  const activeFamily = searchParams.get('family') as CommunityFamily | null
  const activeKey = activeFamily ?? 'all'

  const allCommunities = useMemo(() => data?.data ?? [], [data])
  
  const filteredCommunities = useMemo(() => {
    if (!activeFamily) return allCommunities
    return allCommunities.filter((c) => readCommunityFamily(c) === activeFamily)
  }, [allCommunities, activeFamily])

  // For Strategy A: "Featured" section when "all" is selected
  // We mock the featured ones by taking the first 6 communities
  const featuredCommunities = useMemo(() => {
    return allCommunities.slice(0, 6)
  }, [allCommunities])
  const featuredCommunityIds = useMemo(
    () => new Set(featuredCommunities.map((community) => community.id)),
    [featuredCommunities],
  )
  const remainingCommunities = useMemo(() => {
    if (activeKey !== 'all') {
      return filteredCommunities
    }
    return filteredCommunities.filter((community) => !featuredCommunityIds.has(community.id))
  }, [activeKey, featuredCommunityIds, filteredCommunities])

  const handleFilterClick = (key: string) => {
    const next = new URLSearchParams(searchParams)
    if (key === 'all') {
      next.delete('family')
    } else {
      next.set('family', key)
    }
    setSearchParams(next, { replace: true })
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  const handleScroll = () => {
    if (!scrollContainerRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
    setShowLeftArrow(scrollLeft > 10)
    // Hide arrow if we are within 10px of the right edge
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
  }

  // Initial check for right arrow visibility on mount
  useEffect(() => {
    handleScroll()
  }, [])

  const scrollByPage = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { clientWidth } = scrollContainerRef.current
      // Scroll by 80% of the visible width to act like a page turn but keep context
      const scrollAmount = direction === 'left' ? -(clientWidth * 0.8) : (clientWidth * 0.8)
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  return (
    <div className="mx-auto max-w-5xl pb-12 pt-8">
      <div className="mb-10">
        <h1 className="text-[32px] font-bold tracking-tight">浏览社区</h1>
      </div>

      {/* Horizontal scrollable filters with arrow */}
      <div className="relative -mx-6 mb-8 px-6 sm:-mx-8 sm:px-8">
        <div className="relative flex items-center">
          <nav 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex flex-nowrap gap-2.5 overflow-x-auto pb-3 pr-12 no-scrollbar" 
            aria-label="社区分类筛选"
          >
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => handleFilterClick(filter.key)}
                className={cn(
                  'shrink-0 inline-flex items-center rounded-md border px-4 py-1.5 text-xs font-medium transition-colors tracking-wide',
                  activeKey === filter.key
                    ? 'border-primary/20 bg-primary/10 text-primary font-semibold'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
                )}
              >
                {filter.label}
              </button>
            ))}
          </nav>
          {showLeftArrow && (
            <div className="absolute bottom-3 left-0 top-0 flex items-center bg-gradient-to-r from-background via-background to-transparent pl-1 pr-8">
              <button 
                onClick={() => scrollByPage('left')}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted/50"
                aria-label="向左滚动"
              >
                <ChevronLeft className="h-5 w-5 text-foreground" />
              </button>
            </div>
          )}
          {showRightArrow && (
            <div className="absolute bottom-3 right-0 top-0 flex items-center bg-gradient-to-l from-background via-background to-transparent pl-8 pr-1">
              <button 
                onClick={() => scrollByPage('right')}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted/50"
                aria-label="向右滚动"
              >
                <ChevronRight className="h-5 w-5 text-foreground" />
              </button>
            </div>
          )}
        </div>
        <div className="mt-1 -mx-1 border-b border-border/60" />
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          加载失败，请稍后重试。
        </div>
      )}

      {!isLoading && !error && filteredCommunities.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
          <p className="text-sm font-medium">还没有社区</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeFamily
              ? `「${COMMUNITY_FAMILY_LABELS[activeFamily] ?? activeFamily}」分类下暂无社区。`
              : '运行 pnpm seed 创建测试社区。'}
          </p>
        </div>
      )}

      {!isLoading && !error && filteredCommunities.length > 0 && (
        <div className="space-y-10">
          {/* Featured Section (Only show when "all" is selected) */}
          {activeKey === 'all' && featuredCommunities.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">为你推荐</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredCommunities.map((community) => (
                  <CommunityCell key={community.id} community={community} />
                ))}
              </div>
            </section>
          )}

          {/* Main List Section */}
          {remainingCommunities.length > 0 ? (
            <section className="space-y-4">
              {activeKey === 'all' && featuredCommunities.length > 0 && (
                <h2 className="text-lg font-semibold tracking-tight">所有社区</h2>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {remainingCommunities.map((community) => (
                  <CommunityCell key={community.id} community={community} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
