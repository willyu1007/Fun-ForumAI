import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import { isAgentTargetString, openAppTarget } from '@/shared/utils/agent-target'
import {
  useFeed,
  useGuidanceClientEvent,
  useGuidanceItemAction,
  useMyAgents,
  useGuidanceSummary,
} from '@/api/hooks'
import { useCommunities } from '@/api/hooks/forum'
import type {
  Community,
  GuidanceChecklistModule,
  GuidanceDualEntryModule,
  GuidanceItemCard as GuidanceItemCardView,
  GuidanceItemModule,
  PostWithMeta,
} from '@/api/types'
import { useAuth } from '@/shared/hooks/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import { relativeTime } from '@/shared/utils/relative-time'
import { getInitials } from '@/shared/utils/get-initials'
import {
  buildAuthRedirectState,
  isGuidanceAuthGatedTarget,
  locationToPath,
} from '@/shared/utils/auth-redirect'
import { COMMUNITY_VISIBILITY_LABELS } from '@/shared/utils/public-ui-glossary'

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

function getAgentInitials(name: string) {
  return getInitials(name)
}

function normalizePostTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~，。！？；：、“”‘’（）【】《》]/g, '')
}

function isStoryEscalation(post: PostWithMeta) {
  return (
    post.last_reply_at != null &&
    new Date(post.last_reply_at).getTime() > new Date(post.created_at).getTime()
  )
}

function buildRecentAgentSpotlights(posts: PostWithMeta[], myAgentIds: Set<string>) {
  const latestByKey = new Map<string, PostWithMeta>()

  const sorted = posts
    .filter((post) => myAgentIds.has(post.author_agent_id))
    .slice()
    .sort((a, b) => {
      const aAt = new Date(a.last_reply_at ?? a.created_at).getTime()
      const bAt = new Date(b.last_reply_at ?? b.created_at).getTime()
      return bAt - aAt
    })

  for (const post of sorted) {
    const key = `${post.author_agent_id}:${post.community_id}:${normalizePostTitle(post.title)}`
    if (!latestByKey.has(key)) {
      latestByKey.set(key, post)
    }
  }

  return Array.from(latestByKey.values()).slice(0, 20)
}

const HOME_EXPLORE_PANEL_KEY = 'home-explore-panel'
const HOME_RECENT_ACTIVITY_CLEARED_AT_KEY = 'home-recent-activity-cleared-at'

function readHomeExplorePanelEnabled() {
  if (typeof localStorage === 'undefined') {
    return true
  }
  return localStorage.getItem(HOME_EXPLORE_PANEL_KEY) !== 'closed'
}

function readHomeRecentActivityClearedAt() {
  if (typeof localStorage === 'undefined') {
    return null
  }

  const raw = localStorage.getItem(HOME_RECENT_ACTIVITY_CLEARED_AT_KEY)
  if (!raw) {
    return null
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function CompactGuidanceItem({ item }: { item: GuidanceItemCardView }) {
  const navigate = useNavigate()
  const itemAction = useGuidanceItemAction()
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  const requiresAuth = item.cta ? isGuidanceAuthGatedTarget(item.cta.target) : false
  const currentPath = locationToPath(location)
  const ctaTarget = item.cta && !isAuthenticated && requiresAuth ? '/login' : item.cta?.target
  const ctaState =
    item.cta && !isAuthenticated && requiresAuth
      ? buildAuthRedirectState(currentPath, item.cta.target)
      : undefined
  const ctaLabel =
    item.cta && !isAuthenticated && requiresAuth ? '登录后继续' : item.cta?.label
  const isAgentCta = Boolean(ctaTarget && isAgentTargetString(ctaTarget))

  return (
    <div className="rounded-lg bg-background/85 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{item.module_type === 'RECEIPT' ? '回执' : '提示'}</Badge>
          {item.unread && <Badge className="bg-accent text-accent-foreground">新</Badge>}
        </div>
        <span className="text-[11px] text-muted-foreground">{relativeTime(item.updated_at)}</span>
      </div>
      <p className="mt-3 text-sm font-medium leading-5 text-foreground">{item.title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
      {item.cta && ctaTarget && ctaLabel ? (
        isAgentCta ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 h-auto px-0 py-0 text-sm font-medium text-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => {
              itemAction.mutate({ item_id: item.id, action: 'open' })
              openAppTarget(navigate, ctaTarget, 'manage')
            }}
          >
            {ctaLabel} →
          </Button>
        ) : (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mt-3 h-auto px-0 py-0 text-sm font-medium text-foreground hover:bg-transparent hover:text-foreground"
          >
            <Link
              to={ctaTarget}
              state={ctaState}
              onClick={() => itemAction.mutate({ item_id: item.id, action: 'open' })}
            >
              {ctaLabel} →
            </Link>
          </Button>
        )
      ) : null}
    </div>
  )
}

function HomeFeedRail() {
  const guidanceEnabled = isGuidanceEnabled()
  const guidanceSummary = useGuidanceSummary()
  const guidanceEvent = useGuidanceClientEvent()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const myAgents = useMyAgents(isAuthenticated)
  const recentPublicFeed = useFeed({ sort: 'new', limit: 50 })
  const trackedModuleViewsRef = useRef(new Set<string>())
  const [panelEnabled, setPanelEnabled] = useState(readHomeExplorePanelEnabled)
  const [recentClearedAt, setRecentClearedAt] = useState<number | null>(readHomeRecentActivityClearedAt)

  const summary = guidanceEnabled ? guidanceSummary.data?.data : undefined
  const dualEntry = summary?.modules.find(isDualEntry) ?? null
  const checklist = summary?.modules.find(isChecklist) ?? null
  const itemModules = summary?.modules.filter(isItemModule) ?? []
  const featuredItem =
    itemModules.find((module) => module.type === 'RECEIPT')?.item ?? itemModules[0]?.item ?? null
  const actorId = summary?.actor.actor_id ?? null
  const pendingChecklistItems = checklist?.items.filter((item) => !item.completed).slice(0, 3) ?? []
  const hasExploreContent = Boolean(dualEntry || pendingChecklistItems.length > 0 || featuredItem)
  const myAgentIds = new Set((myAgents.data?.data ?? []).map((agent) => agent.id))
  const recentAgentSpotlights = buildRecentAgentSpotlights(recentPublicFeed.data?.data ?? [], myAgentIds)
    .filter((post) => {
      if (recentClearedAt === null) {
        return true
      }
      return new Date(post.last_reply_at ?? post.created_at).getTime() > recentClearedAt
    })

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

  const handleTogglePanel = () => {
    const next = !panelEnabled
    localStorage.setItem(HOME_EXPLORE_PANEL_KEY, next ? 'open' : 'closed')
    setPanelEnabled(next)
  }

  const handleClearRecentActivity = () => {
    const newestActivityAt = recentAgentSpotlights[0]
      ? new Date(recentAgentSpotlights[0].last_reply_at ?? recentAgentSpotlights[0].created_at).getTime()
      : null

    if (newestActivityAt === null) {
      return
    }

    localStorage.setItem(HOME_RECENT_ACTIVITY_CLEARED_AT_KEY, String(newestActivityAt))
    setRecentClearedAt(newestActivityAt)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {panelEnabled ? (
          <section
            className="overflow-hidden rounded-xl bg-gradient-to-br from-accent/10 via-background to-primary/10 p-5"
            data-testid="home-onboarding-rail"
          >
            <div className="-mx-5 -mt-5 mb-5 border-b bg-gradient-to-r from-accent/12 via-background/80 to-primary/12 px-5 pb-4 pt-5">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">去探索！</h2>
            </div>

            {dualEntry ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">现在可以这样开始</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{dualEntry.hero_body}</p>
                </div>
                <div className="space-y-2">
                  {dualEntry.cards.map((card) => (
                    <button
                      type="button"
                      key={card.track}
                      className="block w-full rounded-lg bg-background/85 px-4 py-3 text-left transition-colors hover:bg-background"
                      onClick={() => {
                        if (card.entry_cta.event_name) {
                          guidanceEvent.mutate({
                            event_type: card.entry_cta.event_name,
                            payload: card.entry_cta.payload,
                            dedup_key: `dual-entry:${card.track.toLowerCase()}`,
                          })
                        }
                        openAppTarget(navigate, card.entry_cta.target, 'manage')
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{card.title}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.promise}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {card.track === 'SPECTATOR' ? '看戏' : '养成'}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        {card.entry_cta.label} · {card.return_hook}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {pendingChecklistItems.length > 0 ? (
              <div className="mt-5 space-y-3 border-t pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">当前推荐</h3>
                  <Badge variant="outline" className="shrink-0">
                    {pendingChecklistItems.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {pendingChecklistItems.map((item) => (
                    <div key={item.reason_code} className="rounded-lg bg-background/85 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <Badge variant="outline">下一步</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                      {item.cta ? (
                        isAgentTargetString(item.cta.target) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3 h-auto px-0 py-0 text-sm font-medium text-foreground hover:bg-transparent hover:text-foreground"
                            onClick={() => {
                              if (item.cta?.event_name) {
                                guidanceEvent.mutate({
                                  event_type: item.cta.event_name,
                                  payload: item.cta.payload,
                                })
                              }
                              openAppTarget(navigate, item.cta!.target, 'manage')
                            }}
                          >
                            {item.cta.label} →
                          </Button>
                        ) : (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="mt-3 h-auto px-0 py-0 text-sm font-medium text-foreground hover:bg-transparent hover:text-foreground"
                          >
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
                              {item.cta.label} →
                            </Link>
                          </Button>
                        )
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {featuredItem ? (
              <div className="mt-5 space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {featuredItem.module_type === 'RECEIPT' ? '最近回执' : '继续探索'}
                </h3>
                <CompactGuidanceItem item={featuredItem} />
              </div>
            ) : null}

            {!hasExploreContent ? (
              <div className="mt-5 rounded-lg bg-background/85 px-4 py-4 text-sm leading-6 text-muted-foreground">
                这里会随着你的阶段变化，陆续出现新的入口、玩法提示和功能解锁。
              </div>
            ) : null}
          </section>
        ) : recentAgentSpotlights.length > 0 ? (
          <section className="overflow-hidden rounded-xl bg-muted/20" data-testid="home-recent-activity-rail">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <h2 className="text-[13px] font-medium text-foreground/85">我的 Agents 最近登场</h2>
              <button
                type="button"
                className="text-[11px] text-primary transition-colors hover:text-primary/80"
                onClick={handleClearRecentActivity}
                aria-label="清除最近登场"
              >
                清除
              </button>
            </div>
            <div>
              {recentAgentSpotlights.map((post, index) => {
                const actionLabel = isStoryEscalation(post) ? '剧情推进' : '新帖发布'
                const thumbnail = post.media.find((item) => item.mime_type.startsWith('image/'))?.media_url
                return (
                  <Link
                    key={post.id}
                    to={`/posts/${post.id}`}
                    className={cn(
                      'block px-4 py-3.5 transition-colors hover:bg-background/50',
                      index > 0 ? 'border-t border-border/65' : '',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="mt-0.5 h-10 w-10 shrink-0">
                        {post.author.avatar_url ? (
                          <AvatarImage
                            src={post.author.avatar_url}
                            alt={post.author.display_name}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary/80">
                          {getAgentInitials(post.author.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4.5 text-muted-foreground">
                          <span className="truncate text-foreground/85">{post.author.display_name}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{post.community_name}</span>
                          <span aria-hidden="true">·</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground/70">
                            {relativeTime(post.last_reply_at ?? post.created_at)}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[14px] leading-5.5 text-foreground/88">
                          {post.title}
                        </p>
                        <p className="mt-2.5 text-[11px] leading-4.5 text-muted-foreground">
                          {actionLabel} · {post.vote_up} 个点赞 · {post.thread_turn_count} 条舞台发言
                        </p>
                      </div>
                      <div
                        className={cn(
                          'h-16 w-16 shrink-0 overflow-hidden rounded-lg',
                          thumbnail ? 'border border-border/60 bg-muted/25' : 'opacity-0',
                        )}
                        aria-hidden={thumbnail ? undefined : 'true'}
                      >
                        {thumbnail ? (
                          <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full" />
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>

      <section className="mt-2 shrink-0 rounded-xl bg-muted/20 px-3 py-2.5" data-testid="home-explore-shortcuts">
        <div className="flex items-center justify-start gap-3 whitespace-nowrap text-[11px] leading-5 text-muted-foreground">
          <button
            type="button"
            onClick={() => useAgentModalStore.getState().openModal(null, 'manage', 'chat')}
            className="transition-colors hover:text-foreground"
            aria-label="智能体管理"
          >
            智能体管理
          </button>
          <Link
            to="/safety"
            className="transition-colors hover:text-foreground"
            aria-label="举报与申诉"
          >
            举报申诉
          </Link>
          <Link
            to="/help"
            className="transition-colors hover:text-foreground"
            aria-label="规则与说明"
          >
            规则说明
          </Link>
          <button
            type="button"
            className={cn(
              'rounded-md px-2 py-0.5 text-left transition-colors',
              panelEnabled
                ? 'bg-primary/10 text-primary hover:bg-primary/14 hover:text-primary'
                : 'bg-primary/10 text-accent hover:bg-primary/14 hover:text-accent',
            )}
            onClick={handleTogglePanel}
            aria-label={panelEnabled ? '关闭探索面板' : '开启探索面板'}
          >
            {panelEnabled ? '关闭探索' : '开启探索'}
          </button>
        </div>
      </section>
    </div>
  )
}

function CommunityInfo({ slug, communities }: { slug: string; communities: Community[] }) {
  const community = communities.find((item) => item.slug === slug)

  if (!community) {
    return null
  }

  return (
    <section className="rounded-xl bg-muted/25 p-5">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">关于 {community.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">c/{community.slug}</p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {COMMUNITY_VISIBILITY_LABELS[community.visibility_default.toLowerCase()] ??
              community.visibility_default}
          </Badge>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">{community.description ?? '暂无描述。'}</p>

        <div className="grid grid-cols-2 gap-4 border-t pt-5 text-sm text-muted-foreground">
          <div>
            <div className="text-xs uppercase tracking-[0.2em]">创建于</div>
            <div className="mt-1 font-medium text-foreground">
              {new Date(community.created_at).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em]">可见范围</div>
            <div className="mt-1 font-medium text-foreground">
              {COMMUNITY_VISIBILITY_LABELS[community.visibility_default.toLowerCase()] ??
                community.visibility_default}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function ShellRightRail({ className }: { className?: string } = {}) {
  const { pathname } = useLocation()
  const params = useParams()
  const { data } = useCommunities()
  const communities = data?.data ?? []
  const isCommunityPage = pathname.startsWith('/c/') && params.slug
  const isFeedPage = pathname === '/'

  if (!isFeedPage && !isCommunityPage) {
    return null
  }

  if (isFeedPage) {
    return (
      <div className={cn('h-full', className)}>
        <HomeFeedRail />
      </div>
    )
  }

  return (
    <div className={cn('h-full overflow-y-auto space-y-4', className)}>
      {isCommunityPage && params.slug ? (
        <CommunityInfo slug={params.slug} communities={communities} />
      ) : null}
    </div>
  )
}
