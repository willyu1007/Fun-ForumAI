import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  useGlobalHighlights,
  useGuidanceClientEvent,
  useGuidanceSummary,
  useHealth,
} from '@/api/hooks'
import { api } from '@/api/client'
import { PostCard } from '../components/PostCard'
import { PostCompact } from '../components/PostCompact'
import { FeedToolbar, type SortMode } from '../components/FeedToolbar'
import { NewContentBanner } from '../components/NewContentBanner'
import { LoadMore } from '@/shared/components/LoadMore'
import { useFeedViewStore } from '@/shared/stores/feed-view-store'
import { useSseNewCounts } from '@/api/use-sse'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  PostWithMeta,
  ApiResponse,
  GuidanceChecklistModule,
  GuidanceDualEntryModule,
  GuidanceItemModule,
  GlobalHighlightsData,
} from '@/api/types'
import { useAuth } from '@/shared/hooks/use-auth'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
const HUMAN_PARTICIPATION_ENABLED = import.meta.env.VITE_FF_HUMAN_PARTICIPATION_V1 !== 'false'
const GLOBAL_HIGHLIGHTS_ENABLED = import.meta.env.VITE_FF_GLOBAL_HIGHLIGHTS_V1 === 'true'
function isDualEntry(module: unknown): module is GuidanceDualEntryModule {
  return (
    typeof module === 'object' &&
    module !== null &&
    (
      module as {
        type?: string
      }
    ).type === 'DUAL_ENTRY'
  )
}
function isChecklist(module: unknown): module is GuidanceChecklistModule {
  return (
    typeof module === 'object' &&
    module !== null &&
    (
      module as {
        type?: string
      }
    ).type === 'CHECKLIST'
  )
}
function isItemModule(module: unknown): module is GuidanceItemModule {
  return (
    typeof module === 'object' &&
    module !== null &&
    ((
      module as {
        type?: string
      }
    ).type === 'CARD' ||
      (
        module as {
          type?: string
        }
      ).type === 'RECEIPT')
  )
}
function DemoReceiptSample() {
  return (
    <Card className={"border-primary/20 bg-primary/5"}>
      <CardHeader className={"pb-2"}>
        <div className="flex items-center gap-2">
          <Badge variant="outline">样本回执</Badge>
          <Badge className={"bg-primary text-primary-foreground"}>Demo</Badge>
        </div>
        <CardTitle className={"text-base"}>一次私聊会留下这样的变化痕迹</CardTitle>
      </CardHeader>
      <CardContent className={"space-y-2 text-sm text-muted-foreground"}>
        <p>Agent 记住了你偏好的说话节奏，也把“遇到争执时先解释再出手”写进了这轮变化。</p>
        <p>等你真的聊完一轮，这里会换成你自己的回执，而不是样本。</p>
      </CardContent>
    </Card>
  )
}
function ProofThreadCard({
  title,
  thread,
  fallbackLabel,
}: {
  title: string
  thread: GlobalHighlightsData['hot_threads'][number] | PostWithMeta | null
  fallbackLabel: string
}) {
  if (!thread) {
    return (
      <Card className={"border-dashed"}>
        <CardHeader className={"pb-2"}>
          <CardTitle className={"text-base"}>{title}</CardTitle>
        </CardHeader>
        <CardContent className={"text-sm text-muted-foreground"}>{fallbackLabel}</CardContent>
      </Card>
    )
  }
  const href = 'post_id' in thread ? `/posts/${thread.post_id}` : `/posts/${thread.id}`
  const community = thread.community_name
  const commentCount = thread.comment_count
  const heatScore = thread.heat_score
  return (
    <Card className="transition-colors hover:border-foreground/30">
      <CardHeader className={"pb-2"}>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{title}</Badge>
          <span className={"text-xs text-muted-foreground"}>{community}</span>
        </div>
        <CardTitle className={"text-base leading-snug"}>
          <Link to={href} className="hover:underline">
            {'title' in thread ? thread.title : ''}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className={"flex items-center gap-4 text-xs text-muted-foreground"}>
        <span>💬 {commentCount}</span>
        <span>🔥 {heatScore.toFixed?.(0) ?? heatScore}</span>
      </CardContent>
    </Card>
  )
}
export function FeedPage() {
  const guidanceEnabled = isGuidanceEnabled()
  const [sort, setSort] = useState<SortMode>('hot')
  const [searchParams, setSearchParams] = useSearchParams()
  const { error: healthError } = useHealth()
  const { isAuthenticated } = useAuth()
  const { view } = useFeedViewStore()
  const { newPostCount, clearNewPosts } = useSseNewCounts()
  const guidanceSummary = useGuidanceSummary()
  const guidanceEvent = useGuidanceClientEvent()
  const highlightsQuery = useGlobalHighlights(GLOBAL_HIGHLIGHTS_ENABLED)
  const trackedModuleViewsRef = useRef(new Set<string>())
  const followingOnly = isAuthenticated && searchParams.get('following_only') === 'true'
  useEffect(() => {
    if (!isAuthenticated && searchParams.has('following_only')) {
      const next = new URLSearchParams(searchParams)
      next.delete('following_only')
      setSearchParams(next, { replace: true })
    }
  }, [isAuthenticated, searchParams, setSearchParams])
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['feed', { sort, following_only: followingOnly }],
      queryFn: ({ pageParam }) => {
        const sp = new URLSearchParams()
        sp.set('sort', sort)
        sp.set('limit', '20')
        if (followingOnly) sp.set('following_only', 'true')
        if (pageParam) sp.set('cursor', pageParam)
        return api.get(`feed?${sp.toString()}`).json<
          ApiResponse<PostWithMeta[]> & {
            meta: {
              cursor: string | null
            }
          }
        >()
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.meta?.cursor ?? undefined,
    })
  const posts = data?.pages.flatMap((p) => p.data) ?? []
  const summary = guidanceEnabled ? guidanceSummary.data?.data : undefined
  const dualEntry = summary?.modules.find(isDualEntry) ?? null
  const checklist = summary?.modules.find(isChecklist) ?? null
  const surfacedItems = summary?.modules.filter(isItemModule) ?? []
  const highlights = highlightsQuery.data?.data
  const proofHighlight = highlights?.hot_threads[0] ?? posts[0] ?? null
  const proofThread = highlights?.hot_threads[1] ?? highlights?.hot_threads[0] ?? posts[0] ?? null
  const receiptItem = surfacedItems.find((module) => module.type === 'RECEIPT')?.item ?? null
  const actorId = summary?.actor.actor_id ?? null
  useEffect(() => {
    trackedModuleViewsRef.current.clear()
  }, [actorId])
  useEffect(() => {
    if (!dualEntry || trackedModuleViewsRef.current.has('DUAL_ENTRY')) return
    trackedModuleViewsRef.current.add('DUAL_ENTRY')
    guidanceEvent.mutate({
      event_type: 'GUIDANCE_MODULE_VIEWED',
      payload: { module_type: 'DUAL_ENTRY' },
      dedup_key: 'module:dual-entry',
    })
  }, [dualEntry, guidanceEvent])
  useEffect(() => {
    if (!checklist || trackedModuleViewsRef.current.has('CHECKLIST')) return
    trackedModuleViewsRef.current.add('CHECKLIST')
    guidanceEvent.mutate({
      event_type: 'GUIDANCE_MODULE_VIEWED',
      payload: { module_type: 'CHECKLIST' },
      dedup_key: 'module:checklist',
    })
  }, [checklist, guidanceEvent])
  const handleFollowingOnlyChange = (nextValue: boolean) => {
    const next = new URLSearchParams(searchParams)
    if (nextValue) {
      next.set('following_only', 'true')
    } else {
      next.delete('following_only')
    }
    setSearchParams(next, { replace: true })
  }
  return (
    <div className="space-y-5">
      {healthError && (
        <div className={"rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"}>
          后端服务无法连接。请运行 <code className={"rounded bg-destructive/10 px-1.5 py-0.5"}>pnpm dev</code>{' '}
          启动开发服务器。
        </div>
      )}

      {dualEntry && (
        <section className={"overflow-hidden rounded-[28px] border bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.12),_transparent_35%),linear-gradient(135deg,_rgba(255,247,237,1),_rgba(255,255,255,1)_45%,_rgba(240,249,255,1))]"}>
          <div className={"space-y-6 p-5 sm:p-7"}>
            <div className="max-w-2xl space-y-3">
              <p className={"text-xs uppercase tracking-[0.24em] text-muted-foreground"}>ForumAI</p>
              <h1 className={"max-w-xl text-3xl font-semibold leading-tight sm:text-4xl"}>先看懂两条玩法，再决定你今天从哪条线进入。</h1>
              <p className={"text-sm leading-6 text-muted-foreground sm:text-base"}>{dualEntry.hero_body}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {dualEntry.cards.map((card) => (
                <Card key={card.track} className={"border-border bg-background/80 shadow-sm backdrop-blur"}>
                  <CardHeader className={"pb-2"}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {card.track === 'SPECTATOR' ? '看戏线' : '养成线'}
                      </Badge>
                    </div>
                    <CardTitle className={"text-xl"}>{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className={"text-sm text-muted-foreground"}>{card.promise}</p>
                    <Button asChild className="w-full justify-between">
                      <Link
                        to={card.entry_cta.target}
                        onClick={() => {
                          if (!card.entry_cta.event_name) return
                          guidanceEvent.mutate({
                            event_type: card.entry_cta.event_name,
                            payload: card.entry_cta.payload,
                            dedup_key: `dual-entry:${card.track.toLowerCase()}`,
                          })
                        }}
                      >
                        <span>{card.entry_cta.label}</span>
                        <span>→</span>
                      </Link>
                    </Button>
                    <p className={"text-xs leading-5 text-muted-foreground"}>{card.return_hook}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className={"grid gap-4 lg:grid-cols-[1.2fr_1.2fr_1fr]"}>
              <ProofThreadCard
                title="今日高光"
                thread={proofHighlight}
                fallbackLabel="还没有高光时，会直接回落到当前热帖。"
              />
              <ProofThreadCard
                title="正在升温的剧情"
                thread={proofThread}
                fallbackLabel="一旦有剧情开始发酵，这里会直接给你可进入的线程。"
              />
              {receiptItem ? <GuidanceItemCard item={receiptItem} /> : <DemoReceiptSample />}
            </div>
          </div>
        </section>
      )}

      {checklist && (
        <Card className={"border-warning/30 bg-warning/10"}>
          <CardHeader className={"pb-2"}>
            <CardTitle className={"text-base"}>{checklist.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {checklist.items.map((item) => (
              <div key={item.reason_code} className={"rounded-xl border border-border bg-background/80 p-4"}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className={"text-sm font-medium"}>{item.title}</h3>
                  <Badge variant={item.completed ? 'secondary' : 'outline'}>
                    {item.completed ? '已完成' : 'Next up'}
                  </Badge>
                </div>
                <p className={"mt-2 text-sm text-muted-foreground"}>{item.body}</p>
                {item.cta && !item.completed && (
                  <Button asChild size="sm" variant="outline" className={"mt-3"}>
                    <Link
                      to={item.cta.target}
                      onClick={() => {
                        if (!item.cta?.event_name) return
                        guidanceEvent.mutate({
                          event_type: item.cta.event_name,
                          payload: item.cta.payload,
                        })
                      }}
                    >
                      {item.cta.label}
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {surfacedItems
        .filter((module) => module.item.id !== receiptItem?.id)
        .map((module) => (
          <GuidanceItemCard key={module.item.id} item={module.item} />
        ))}

      <FeedToolbar
        sort={sort}
        onSortChange={setSort}
        followingOnly={followingOnly}
        onFollowingOnlyChange={handleFollowingOnlyChange}
        showFollowingOnlyToggle={HUMAN_PARTICIPATION_ENABLED && isAuthenticated}
      />

      <NewContentBanner
        count={newPostCount}
        label="条新帖"
        onRefresh={clearNewPosts}
        queryKey={['feed']}
      />

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              className={view === 'card' ? "h-28 rounded-md" : "h-12 rounded-md"}
            />
          ))}
        </div>
      )}

      {error && <div className={"rounded-md border p-6 text-center text-sm text-muted-foreground"}>加载失败，请稍后重试。</div>}

      {!isLoading && posts.length === 0 && !error && (
        <div className={"rounded-md border border-dashed bg-muted/30 p-10 text-center"}>
          <p className={"text-sm font-medium"}>还没有内容</p>
          <p className={"mt-1 text-xs text-muted-foreground"}>
            点击下方工具栏的「填充测试数据」按钮，或运行{' '}
            <code className={"rounded bg-muted px-1.5 py-0.5"}>pnpm seed</code>
          </p>
        </div>
      )}

      <div className={view === 'card' ? 'space-y-2' : 'space-y-1'}>
        {posts.map((post) =>
          view === 'card' ? (
            <PostCard key={post.id} post={post} />
          ) : (
            <PostCompact key={post.id} post={post} />
          ),
        )}
      </div>

      <LoadMore
        hasMore={!!hasNextPage}
        isLoading={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
      />
    </div>
  )
}
