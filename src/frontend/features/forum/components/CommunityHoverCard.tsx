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
  readCommunitySurfaceSettings,
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
import type { CommunityInteractionContract, CommunitySemanticContract } from '../../../../shared/semantic-taxonomy'
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
  >
> & {
  community_semantics?: Partial<CommunitySemanticContract> | null
}

export interface CommunityHoverCardSurfacePreview extends CommunityHoverPreview {
  banner_image_url?: string | null
  avatar_image_url?: string | null
  visibility_default?: string | null
  created_at?: string | null
  interaction_contract?: CommunityInteractionContract | null
  rules_json?: Record<string, unknown> | null
}

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

export function CommunityHoverCardPanel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'w-[calc(100vw-1.5rem)] max-w-[23rem] overflow-hidden rounded-[20px] border border-border/70 bg-popover p-0 shadow-xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CommunityHoverCardSurface({
  slug,
  preview,
  isAuthenticated,
  isSubscribed,
  communityId,
  followBusy,
  onFollowToggle,
  currentPath,
  onNavigate,
  showAction = true,
  showEnterLink = true,
  headerAction,
  metaSection,
  descriptionSlot,
}: {
  slug: string
  preview?: CommunityHoverCardSurfacePreview
  isAuthenticated: boolean
  isSubscribed: boolean
  communityId: string
  followBusy: boolean
  onFollowToggle?: () => void
  currentPath: string
  onNavigate?: () => void
  showAction?: boolean
  showEnterLink?: boolean
  headerAction?: React.ReactNode
  metaSection?: React.ReactNode
  descriptionSlot?: React.ReactNode
}) {
  const surfaceSettings = readCommunitySurfaceSettings({
    rules_json: preview?.rules_json ?? null,
    description: preview?.description ?? null,
  })
  const name = preview?.name ?? slug
  const description =
    preview?.snippet?.trim()
    || surfaceSettings.publicIntro?.trim()
    || preview?.description?.trim()
    || '还没有公开简介。'
  const activeMemberCount = preview?.active_member_count ?? null
  const activity7d = preview?.activity_7d ?? null
  const metricsSummary = buildCommunityMetricsSummary({
    activeMemberCount,
    activity7d,
  })
  const semanticSource = preview ?? null
  const communityFamily = readCommunityFamily(semanticSource)
  const visibilityLabel =
    typeof preview?.visibility_default === 'string'
      ? COMMUNITY_VISIBILITY_LABELS[preview.visibility_default.toLowerCase()] ?? preview.visibility_default
      : null
  const category =
    readCommunityShellCategory(semanticSource)
    ?? resolveCommunityCategory({
      slug,
      name,
      description: preview?.description ?? null,
      community_semantics: preview?.community_semantics ?? null,
    })
  const createdAtLabel = formatCompactDate(preview?.created_at ?? null)
  const participationSummary = describeCommunityParticipation({
    publicParticipationMode: semanticSource?.interaction_contract?.public_participation_mode,
    audienceSignalIngestion: semanticSource?.interaction_contract?.audience_signal_ingestion,
    agentHumanResponseMode: semanticSource?.interaction_contract?.agent_human_response_mode,
  })
  const familyLabel = communityFamily ? COMMUNITY_FAMILY_LABELS[communityFamily] ?? communityFamily : null
  const categoryLabel = COMMUNITY_CATEGORY_LABELS[category] ?? category
  const topicLabel = familyLabel
    ? `主题：${categoryLabel} · ${familyLabel}`
    : `主题：${categoryLabel}`
  const bannerImageUrl = preview?.banner_image_url ?? surfaceSettings.bannerImageUrl
  const avatarImageUrl = preview?.avatar_image_url ?? surfaceSettings.avatarImageUrl
  const bannerTheme = bannerImageUrl
    ? { type: 'custom_image' as const, value: bannerImageUrl }
    : getCommunityBannerTheme({
        slug,
        rules_json: preview?.rules_json ?? null,
        description: preview?.description ?? null,
      })
  const avatarTheme = avatarImageUrl
    ? { type: 'custom_image' as const, value: avatarImageUrl }
    : getCommunityAvatarTheme({
        slug,
        rules_json: preview?.rules_json ?? null,
        description: preview?.description ?? null,
      })

  return (
    <>
      <div className="relative h-16 overflow-hidden border-b border-border/45">
        <img
          src={bannerTheme.value}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {'overlayClassName' in bannerTheme && bannerTheme.overlayClassName ? (
          <div className={cn('absolute inset-0', bannerTheme.overlayClassName)} aria-hidden="true" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-background/6 via-background/10 to-background/22" />
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background/10 via-background/4 to-transparent" />
      </div>

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

          {headerAction ? (
            <div className="shrink-0">{headerAction}</div>
          ) : showAction ? (
            <div className="shrink-0">
              {isAuthenticated ? (
                <Button
                  type="button"
                  size="sm"
                  shape="pill"
                  variant={isSubscribed ? 'secondary' : 'default'}
                  className="h-7 px-3 text-[12px]"
                  disabled={!communityId || followBusy}
                  onClick={onFollowToggle}
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
          ) : null}
        </div>

        <div className="mt-4 space-y-4">
          {descriptionSlot !== undefined ? descriptionSlot : (
            <p className="line-clamp-5 text-[13px] leading-6 text-foreground/78">
              {description}
            </p>
          )}

          {metaSection !== undefined ? metaSection : (
            <div className="space-y-2 border-t border-border/55 pt-3">
              <p className="text-[11px] leading-5 text-muted-foreground">{topicLabel}</p>
              {participationSummary ? (
                <p className="text-[11px] leading-5 text-muted-foreground">
                  {participationSummary}
                </p>
              ) : null}
            </div>
          )}

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
              {showEnterLink ? (
                <Link
                  to={`/c/${slug}`}
                  className="ml-auto text-[12px] font-semibold text-foreground transition-colors hover:text-primary"
                  onClick={() => onNavigate?.()}
                >
                  进入社区
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
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
  const currentPath = locationToPath(location)
  const shouldShowLoadingState = !preview && !community
  const surfacePreview: CommunityHoverCardSurfacePreview | undefined = community
    ? ({
        ...community,
        banner_image_url: null,
        avatar_image_url: null,
      } satisfies CommunityHoverCardSurfacePreview)
    : preview

  return (
      <HoverCard openDelay={320} closeDelay={160} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={10}
        className="w-auto border-0 bg-transparent p-0 shadow-none"
      >
        <CommunityHoverCardPanel>
          {shouldShowLoadingState ? (
            <HoverLoadingState />
          ) : (
            <CommunityHoverCardSurface
              slug={slug}
              preview={surfacePreview}
              isAuthenticated={isAuthenticated}
              isSubscribed={isSubscribed}
              communityId={communityId}
              followBusy={followBusy}
              onFollowToggle={() => {
                if (!communityId || followBusy) return
                if (isSubscribed) {
                  unfollowCommunity.mutate()
                  return
                }
                followCommunity.mutate()
              }}
              currentPath={currentPath}
              onNavigate={onNavigate}
            />
          )}
        </CommunityHoverCardPanel>
      </HoverCardContent>
    </HoverCard>
  )
}
