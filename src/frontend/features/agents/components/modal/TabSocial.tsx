import { useMemo, useState } from 'react'
import {
  useAgentProfile,
  useAgentRelationSummary,
  useAgentRelations,
  useFollowAgent,
  useOwnerLifeOverview,
  useUpdateAgentProfile,
  useUnfollowAgent,
} from '@/api/hooks'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { PresetCoverDialog } from '@/shared/components/PresetCoverDialog'
import { useAuth } from '@/shared/hooks/use-auth'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import {
  AGENT_MOMENTS_COVER_PRESETS,
  DEFAULT_AGENT_MOMENTS_COVER_SRC,
  resolveAgentMomentsCoverSrc,
} from '@/shared/utils/preset-agent-moments-covers'
import { resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import { X } from 'lucide-react'
import type { Agent, AgentRelationItem, AgentRelationView, OwnerNowCompany } from '@/api/types'

type SocialOverviewSectionId = 'following' | 'followers' | 'friends' | 'recentCompany'

const RELATION_LIST_LIMIT = 24

const OVERVIEW_SECTIONS: Array<{
  id: SocialOverviewSectionId
  title: string
}> = [
  { id: 'following', title: '关注' },
  { id: 'followers', title: '粉丝' },
  { id: 'friends', title: '好友' },
  { id: 'recentCompany', title: '最近同框' },
]

export function TabSocial({ agentId }: { agentId: string }) {
  const { data: profileData } = useAgentProfile(agentId)
  const agent = profileData?.data
  const { user } = useAuth()
  const { viewMode } = useAgentModalStore()
  const isOwner = viewMode === 'manage' && !!user && !!agent && user.id === agent.owner_id
  const [activePanel, setActivePanel] = useState<SocialOverviewSectionId | null>(null)
  const [backgroundDialogOpen, setBackgroundDialogOpen] = useState(false)
  const updateAgentProfile = useUpdateAgentProfile(agentId)

  const relationSummaryQuery = useAgentRelationSummary(agentId, isOwner)
  const lifeOverviewQuery = useOwnerLifeOverview(agentId, isOwner)

  const activeRelationView = useMemo<AgentRelationView | null>(() => {
    if (activePanel === 'following' || activePanel === 'followers' || activePanel === 'friends') {
      return activePanel
    }

    return null
  }, [activePanel])

  const relationListQuery = useAgentRelations(
    agentId,
    activeRelationView
      ? {
          view: activeRelationView,
          limit: RELATION_LIST_LIMIT,
        }
      : undefined,
    isOwner && activeRelationView !== null,
  )

  const counts = {
    following: relationSummaryQuery.data?.data?.following?.effective ?? 0,
    followers: relationSummaryQuery.data?.data?.followers?.effective ?? 0,
    friends: relationSummaryQuery.data?.data?.friends ?? 0,
    recentCompany: lifeOverviewQuery.data?.data?.now?.recent_company?.length ?? 0,
  }

  const recentCompany = lifeOverviewQuery.data?.data?.now?.recent_company ?? []
  const panelTitle = OVERVIEW_SECTIONS.find((section) => section.id === activePanel)?.title ?? ''
  const coverSrc = agent
    ? resolveAgentMomentsCoverSrc({
        id: agent.id,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
        moments_cover_url: agent.moments_cover_url,
      })
    : null
  const avatarSrc = agent
    ? resolveAgentAvatarSrc({
        id: agent.id,
        display_name: agent.display_name,
        avatar_url: agent.avatar_url,
      })
    : null
  const initialCoverSelection = agent?.moments_cover_url ?? DEFAULT_AGENT_MOMENTS_COVER_SRC
  const relationshipEntries = OVERVIEW_SECTIONS.map((section) => ({
    id: section.id,
    label: section.title,
    value:
      section.id === 'following'
        ? String(isOwner ? counts.following : agent?.public_stats?.following_count ?? 0)
        : section.id === 'followers'
          ? String(isOwner ? counts.followers : agent?.public_stats?.followers_count ?? 0)
          : isOwner
            ? String(counts[section.id])
            : '--',
    disabled: !isOwner && (section.id === 'friends' || section.id === 'recentCompany'),
  }))

  return (
    <div className="relative flex h-full flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="border-b bg-card">
          <div className="relative h-[340px]">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt={agent?.display_name ?? '朋友圈头图'}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-muted via-background to-muted" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/18 to-background/48" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/8 via-transparent to-background/18" />

            <div className="absolute right-5 top-5">
              <div className="flex max-w-[70vw] flex-wrap justify-end gap-x-4 gap-y-1 text-right sm:max-w-[440px]">
                {relationshipEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    data-testid={`social-stat-${entry.id}`}
                    disabled={entry.disabled}
                    onClick={() => setActivePanel(entry.id)}
                    className={cn(
                      'whitespace-nowrap text-xs font-medium tracking-tight text-background/78 transition-colors',
                      entry.disabled
                        ? 'cursor-default opacity-72'
                        : activePanel === entry.id
                          ? 'text-background'
                          : 'hover:text-background',
                    )}
                  >
                    {entry.label} {entry.value}
                  </button>
                ))}
              </div>
            </div>

            {isOwner ? (
              <div className="absolute left-5 top-5">
                <button
                  type="button"
                  data-testid="social-cover-settings-button"
                  onClick={() => setBackgroundDialogOpen(true)}
                  className="text-xs font-medium tracking-tight text-background/78 transition-colors hover:text-background"
                >
                  设置背景
                </button>
              </div>
            ) : null}

            <div className="absolute bottom-4 right-36 max-w-[44%] text-right">
              <p className="truncate text-base font-semibold tracking-tight text-background drop-shadow-sm">
                {agent?.display_name ?? '智能体'}
              </p>
            </div>

            <div className="absolute bottom-0 right-5 translate-y-1/4">
              <Avatar className="size-24 shrink-0 rounded-[1.4rem] shadow-xl">
                {avatarSrc ? <AvatarImage src={avatarSrc} alt={`${agent?.display_name ?? '智能体'}头像`} className="object-cover" /> : null}
                <AvatarFallback className="bg-background/88 text-xl font-semibold text-foreground">
                  {(agent?.display_name ?? '智').slice(0, 1)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 pb-8 pt-16">
          <section className="flex min-h-[220px] items-start justify-center pt-10">
            <div className="text-center text-sm text-muted-foreground/88">
              朋友圈功能正在测试中，敬请期待完整版本。
            </div>
          </section>
        </div>
      </div>

      <div
        data-testid="agent-social-detail-panel"
        className={cn(
          'absolute inset-0 z-20 flex justify-end bg-background/16 backdrop-blur-[1px] transition-opacity duration-200',
          activePanel ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setActivePanel(null)}
      >
        <div
          className={cn(
            'flex h-full w-full max-w-xl flex-col border-l bg-background shadow-2xl transition-transform duration-200',
            activePanel ? 'translate-x-0' : 'translate-x-full',
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3">
            <div className="min-w-0">
              <div className="text-base font-semibold text-foreground">{panelTitle}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="关闭社交详情"
              title="关闭社交详情"
              onClick={() => setActivePanel(null)}
              className="h-8 w-8 shrink-0 rounded-lg"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {activePanel ? (
              <SocialDetailPanel
                sectionId={activePanel}
                relationItems={relationListQuery.data?.data?.items ?? []}
                relationLoading={relationListQuery.isLoading}
                recentCompany={recentCompany}
                recentCompanyLoading={lifeOverviewQuery.isLoading}
              />
            ) : null}
          </div>
        </div>
      </div>

      <PresetCoverDialog
        open={backgroundDialogOpen}
        onOpenChange={setBackgroundDialogOpen}
        title="设置背景"
        currentLabel={agent?.display_name ?? '智能体背景'}
        previewSrc={coverSrc}
        initialSelectionSrc={initialCoverSelection}
        presets={AGENT_MOMENTS_COVER_PRESETS}
        savePending={updateAgentProfile.isPending}
        onSave={(selectedSrc) => {
          updateAgentProfile.mutate(
            { moments_cover_url: selectedSrc },
            {
              onSuccess: () => {
                setBackgroundDialogOpen(false)
              },
            },
          )
        }}
      />
    </div>
  )
}

function SocialAgentRow({
  agentId,
  fallbackName,
}: {
  agentId: string
  fallbackName?: string
}) {
  const { user } = useAuth()
  const profileQuery = useAgentProfile(agentId)
  const follow = useFollowAgent(agentId)
  const unfollow = useUnfollowAgent(agentId)
  const profile = profileQuery.data?.data as Agent | undefined
  const displayName = profile?.display_name ?? fallbackName ?? agentId
  const avatarSrc = profile
    ? resolveAgentAvatarSrc({
        id: profile.id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      })
    : null
  const isFollowed = Boolean(profile?.is_followed)
  const followBusy = follow.isPending || unfollow.isPending
  const canToggleFollow = Boolean(
    user
      && profile
      && profile.owner_id !== user.id
      && profile.surface_access?.follow_enabled !== false,
  )

  return (
    <div className="flex items-start gap-3">
      <Avatar className="size-11 shrink-0 rounded-2xl">
        {avatarSrc ? <AvatarImage src={avatarSrc} alt={displayName} className="object-cover" /> : null}
        <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
          {displayName.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="min-w-0">
          {profileQuery.isLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          )}
        </div>

        {canToggleFollow ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-sm"
            onClick={() => {
              if (followBusy) return
              if (isFollowed) {
                unfollow.mutate()
                return
              }
              follow.mutate()
            }}
          >
            {followBusy ? '…' : isFollowed ? '已关注' : '关注'}
          </Button>
        ) : (
          <span className="block text-sm text-muted-foreground">
            {isFollowed ? '已关注' : '关注'}
          </span>
        )}
      </div>
    </div>
  )
}

function SocialDetailPanel({
  sectionId,
  relationItems,
  relationLoading,
  recentCompany,
  recentCompanyLoading,
}: {
  sectionId: SocialOverviewSectionId
  relationItems: AgentRelationItem[]
  relationLoading: boolean
  recentCompany: OwnerNowCompany[]
  recentCompanyLoading: boolean
}) {
  if (sectionId === 'recentCompany') {
    if (recentCompanyLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )
    }

    if (recentCompany.length === 0) {
      return (
        <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          最近同框里还没有可展示的对象。
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
        {recentCompany.map((item) => (
          <SocialAgentRow
            key={item.actor_id}
            agentId={item.actor_id}
            fallbackName={item.actor_name}
          />
        ))}
      </div>
    )
  }

  if (relationLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (relationItems.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        这里暂时还没有可展示的智能体。
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
      {relationItems.map((item) => (
        <SocialAgentRow key={item.relation_id} agentId={item.pair_agent_id} />
      ))}
    </div>
  )
}
