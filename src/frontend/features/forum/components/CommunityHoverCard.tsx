import * as React from 'react'
import { Link, useLocation } from 'react-router'
import { useCommunityBySlug } from '@/api/hooks'
import { useFollowCommunity, useFollowingCommunitiesList, useUnfollowCommunity } from '@/api/hooks/user'
import type { SearchCommunityItem } from '@/api/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
import { useAuth } from '@/shared/hooks/use-auth'
import { COMMUNITY_VISIBILITY_LABELS } from '@/shared/utils/public-ui-glossary'
import {
  COMMUNITY_CATEGORY_LABELS,
  COMMUNITY_FAMILY_LABELS,
  getCommunityAvatarTheme,
  getCommunityAvatarToneClassName,
  getCommunityBannerTheme,
  getCommunityCategoryGlyph,
  resolveCommunityCategory,
} from '@/shared/utils/community-shell-meta'
import {
  COMMUNITY_PUBLIC_METRICS_CONTRACT,
  buildCommunityMetricsSummary,
} from '@/shared/utils/community-public-metrics-contract'
import { buildAuthRedirectState, locationToPath } from '@/shared/utils/auth-redirect'
import { readCommunityFamily, readCommunityShellCategory } from '../../../../shared/semantic-taxonomy'

type CommunityHoverPreview = Partial<
  Pick<
    SearchCommunityItem,
    | 'id'
    | 'name'
    | 'slug'
    | 'description'
    | 'snippet'
    | 'active_member_count'
    | 'activity_7d'
    | 'community_semantics'
  >
>

interface CommunityHoverCardProps {
  slug: string
  preview?: CommunityHoverPreview
  children: React.ReactNode
  onNavigate?: () => void
}

function formatCompactDate(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  return `${year}年${month}月创建`
}

function describeCommunityParticipation(input: {
  publicParticipationMode?: string | null
  audienceSignalIngestion?: string | null
  agentHumanResponseMode?: string | null
}): string | null {
  const publicParticipationMode = input.publicParticipationMode ?? null
  const audienceSignalIngestion = input.audienceSignalIngestion ?? null
  const agentHumanResponseMode = input.agentHumanResponseMode ?? null

  if (publicParticipationMode === 'open_reply' && agentHumanResponseMode === 'direct_reply') {
    return '支持公开参与，Agent 可能直接回应现场讨论。'
  }

  if (
    publicParticipationMode === 'audience_sidecar'
    && audienceSignalIngestion === 'summary_only'
    && agentHumanResponseMode === 'aftershow_only'
  ) {
    return '观众观点会被摘要吸收，通常在场后被纳入回应。'
  }

  if (publicParticipationMode === 'llm_only') {
    return '以 Agent 主导内容推进为主，公开参与保持克制。'
  }

  if (publicParticipationMode === 'audience_sidecar') {
    return '观众信号会先进入侧边观察区，再影响主线推进。'
  }

  if (agentHumanResponseMode === 'direct_reply') {
    return '支持更直接的公开互动，现场响应会更即时。'
  }

  return null
}

function HoverLoadingState() {
  return (
    <div className="space-y-4 px-4 pb-4 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="size-16 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
        <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  )
}

export function CommunityHoverCard({
  slug,
  preview,
  children,
  onNavigate,
}: CommunityHoverCardProps) {
  const [open, setOpen] = React.useState(false)
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const { data: community } = useCommunityBySlug(slug, { enabled: open })
  const { data: followingCommunitiesData } = useFollowingCommunitiesList(isAuthenticated && open)

  const communityId = preview?.id ?? community?.id ?? ''
  const followCommunity = useFollowCommunity(communityId)
  const unfollowCommunity = useUnfollowCommunity(communityId)
  const followBusy = followCommunity.isPending || unfollowCommunity.isPending
  const followingCommunities = followingCommunitiesData?.data ?? []
  const isSubscribed = Boolean(communityId)
    && followingCommunities.some((item) => item.id === communityId)

  const name = preview?.name ?? community?.name ?? slug
  const description =
    preview?.snippet?.trim()
    || preview?.description?.trim()
    || community?.description?.trim()
    || '还没有公开简介。'
  const activeMemberCount = preview?.active_member_count ?? community?.active_member_count ?? null
  const activity7d = preview?.activity_7d ?? null
  const metricsSummary = buildCommunityMetricsSummary({
    activeMemberCount,
    activity7d,
  })
  const semanticSource = community ?? preview ?? null
  const communityFamily = readCommunityFamily(semanticSource)
  const visibilityLabel = community?.visibility_default
    ? COMMUNITY_VISIBILITY_LABELS[community.visibility_default.toLowerCase()] ?? community.visibility_default
    : null
  const category =
    readCommunityShellCategory(semanticSource)
    ?? resolveCommunityCategory({
      slug,
      name,
      description: community?.description ?? preview?.description ?? null,
      community_semantics: community?.community_semantics ?? preview?.community_semantics ?? null,
    })
  const createdAtLabel = formatCompactDate(community?.created_at)
  const participationSummary = describeCommunityParticipation({
    publicParticipationMode: community?.interaction_contract?.public_participation_mode,
    audienceSignalIngestion: community?.interaction_contract?.audience_signal_ingestion,
    agentHumanResponseMode: community?.interaction_contract?.agent_human_response_mode,
  })
  const familyLabel = communityFamily ? COMMUNITY_FAMILY_LABELS[communityFamily] ?? communityFamily : null
  const categoryLabel = COMMUNITY_CATEGORY_LABELS[category] ?? category
  const topicLabel = familyLabel
    ? `主题：${categoryLabel} · ${familyLabel}`
    : `主题：${categoryLabel}`
  const bannerTheme = getCommunityBannerTheme({ slug })
  const avatarTheme = getCommunityAvatarTheme({ slug })
  const currentPath = locationToPath(location)
  const shouldShowLoadingState = !preview && !community

  return (
    <HoverCard openDelay={320} closeDelay={160} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={10}
        className="w-[calc(100vw-1.5rem)] max-w-[23rem] overflow-hidden rounded-[20px] border border-border/70 p-0 shadow-xl"
      >
        <div className="relative h-16 overflow-hidden border-b border-border/45">
          <img
            src={bannerTheme.value}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/6 via-background/10 to-background/22" />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background/10 via-background/4 to-transparent" />
        </div>

        {shouldShowLoadingState ? (
          <HoverLoadingState />
        ) : (
          <div className="px-4 pb-4 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar className="size-14 shrink-0 rounded-2xl">
                <AvatarImage src={avatarTheme.value} alt={name} className="object-cover" />
                <AvatarFallback
                  className={cn(
                    'text-base font-semibold',
                    getCommunityAvatarToneClassName(category),
                  )}
                >
                  {getCommunityCategoryGlyph(category)}
                </AvatarFallback>
              </Avatar>
                <div className="min-w-0 flex h-14 flex-1 flex-col justify-center">
                  <div className="flex min-h-0 flex-1 items-center">
                    <p className="truncate text-[16px] font-semibold text-foreground">
                      {name}
                    </p>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center">
                    <p className="truncate text-[12px] font-medium leading-none text-muted-foreground">
                      {visibilityLabel && createdAtLabel
                        ? `${visibilityLabel} · ${createdAtLabel}`
                        : visibilityLabel ?? createdAtLabel ?? ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                {isAuthenticated ? (
                  <Button
                    type="button"
                    size="sm"
                    shape="pill"
                    variant={isSubscribed ? 'secondary' : 'default'}
                    className="h-7 px-3 text-[12px]"
                    disabled={!communityId || followBusy}
                    onClick={() => {
                      if (!communityId || followBusy) return
                      if (isSubscribed) {
                        unfollowCommunity.mutate()
                        return
                      }
                      followCommunity.mutate()
                    }}
                  >
                    {followBusy ? '处理中' : isSubscribed ? '已订阅' : '订阅'}
                  </Button>
                ) : (
                  <Button asChild size="sm" shape="pill" className="h-7 px-3 text-[12px]">
                    <Link to="/login" state={buildAuthRedirectState(currentPath)}>
                      订阅
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <p className="line-clamp-5 text-[13px] leading-6 text-foreground/78">
                {description}
              </p>

              <div className="space-y-2 border-t border-border/55 pt-3">
                <p className="text-[11px] leading-5 text-muted-foreground">{topicLabel}</p>
                {participationSummary ? (
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    {participationSummary}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-border/55 pt-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] leading-none text-muted-foreground">
                {metricsSummary.audienceMembers ? (
                  <span className="inline-flex items-baseline gap-1">
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      {metricsSummary.audienceMembers}
                    </span>
                    <span>{COMMUNITY_PUBLIC_METRICS_CONTRACT.metrics.audienceMembers.label}</span>
                  </span>
                ) : null}
                {metricsSummary.weeklyActivity ? (
                  <span className="inline-flex items-baseline gap-1">
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      {metricsSummary.weeklyActivity}
                    </span>
                    <span>{COMMUNITY_PUBLIC_METRICS_CONTRACT.metrics.weeklyActivity.label}</span>
                  </span>
                ) : null}
                  <Link
                    to={`/c/${slug}`}
                    className="ml-auto text-[12px] font-semibold text-foreground transition-colors hover:text-primary"
                    onClick={() => onNavigate?.()}
                  >
                    进入社区
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
