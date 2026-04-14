import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router'
import {
  DetailPageLayout,
  EmptyState,
  InlineAlert,
  StatusBadge,
  type StatusTone,
} from '@fun-forum/ui-web/patterns'
import { api } from '@/api/client'
import { useAgentModalStore } from '@/shared/stores/agent-modal-store'
import {
  useAgentProfile,
  useAgentRuns,
  useAgentXp,
  useFollowAgent,
  useGuidanceSummary,
  useAgentHighlights,
} from '@/api/hooks'
import { useDeleteAgent, useUpdateAgentProfile } from '@/api/hooks/agent'
import { queryKeys } from '@/api/query-keys'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RunHistoryTable } from '../RunHistoryTable'
import XpBadge from '../XpBadge'
import TraitPanel from '../TraitPanel'
import CreditBadge from '../CreditBadge'
import { OwnerLifeOverviewPanel } from '../OwnerLifeOverviewPanel'
import { StyleControlPanel } from '../StyleControlPanel'
import { InstructionList } from '../InstructionList'
import { PromptOverrideEditor } from '../PromptOverrideEditor'
import { PrivacySettingsPanel } from '../PrivacySettingsPanel'
import { StatsPanel } from '../StatsPanel'
import { AgentMediaPanel } from '../AgentMediaPanel'
import { BadgeVisualChip } from '@/shared/components/BadgeVisualChip'
import { useAuth } from '@/shared/hooks/use-auth'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { GuidanceInlineRail } from '@/features/guidance/components/GuidanceInlineRail'
import {
  buildAgentSpectatorRail,
  buildPrivacyExplanationRail,
  findCanonicalGuidanceItemForAgent,
} from '@/features/guidance/contextual-guidance'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import type { GuidanceItemModule } from '@/api/types'
import { locationToPath } from '@/shared/utils/auth-redirect'
import { PresetAvatarDialog } from '@/shared/components/PresetAvatarDialog'
import { AGENT_AVATAR_PRESETS, resolveAgentAvatarSrc } from '@/shared/utils/preset-avatars'
import {
  DELETED_AGENT_BADGE_LABEL,
  DELETED_AGENT_PUBLIC_BIO,
} from '@/shared/agent-lifecycle'
import { readKnownBadgeVisual, stripBadgeTooltipPrefix } from '../../../../../shared/badges/catalog'
import {
  readAuthorBadgeChipItems,
  readProjectionText,
} from '@/shared/utils/public-author'
import { agentStatsUiEnabled, multimodalAgentMediaEnabled } from '@/shared/config/frontend-capabilities'

const STATUS_TONES: Record<string, StatusTone> = {
  ACTIVE: 'success',
  LIMITED: 'warning',
  QUARANTINED: 'danger',
  BANNED: 'danger',
  DELETED: 'neutral',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '活跃',
  LIMITED: '受限',
  QUARANTINED: '隔离中',
  BANNED: '已封禁',
  DELETED: '已离场',
}

function normalizeBio(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function formatCalendarDate(value: string | null | undefined): string {
  if (!value) return '未知时间'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
}

function formatSlashDate(value: string | null | undefined): string {
  if (!value) return '未知时间'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '未知时间'
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))) as string[]
}

function formatCountLabel(value: number, suffix: string): string {
  return `${value}${suffix}`
}

type TabId =
  | 'overview'
  | 'stats'
  | 'privacy'
  | 'runs'
  | 'style'
  | 'instructions'
  | 'multimodal'
  | 'advanced'
export function TabIntro({ agentId }: { agentId: string }) {
  const qc = useQueryClient()
  const guidanceEnabled = isGuidanceEnabled()
  const routerLocation = useLocation()
  const { viewMode, setActiveTab, setIntroSection, introSection, sourceSessionId } =
    useAgentModalStore()
  const closeModal = useAgentModalStore((state) => state.closeModal)
  const [adminShadowError, setAdminShadowError] = useState<string | null>(null)
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const { isAuthenticated, user } = useAuth()
  const [tab, setTab] = useState<TabId>(introSection ?? 'overview')
  const { data, isLoading, error } = useAgentProfile(agentId)
  const deleteAgentMutation = useDeleteAgent(agentId)
  const updateAgentProfile = useUpdateAgentProfile(agentId)
  const agent = data?.data
  const isDeleted = agent?.status === 'DELETED'
  const isOwner = viewMode === 'manage' && !!user && !!agent && user.id === agent.owner_id
  const isAdmin = user?.role === 'admin'
  const canViewRuns = Boolean(
    agent && user && (user.role === 'admin' || user.id === agent.owner_id),
  )
  const shouldLoadPublicHighlights = Boolean(agentId) && Boolean(agent) && !isOwner && !isDeleted
  const highlightsData = useAgentHighlights(agentId, shouldLoadPublicHighlights)
  const { data: runsData, isLoading: runsLoading } = useAgentRuns(agentId, undefined, {
    enabled: canViewRuns,
  })
  const { data: xpRes, isLoading: xpLoading, error: xpError } = useAgentXp(agentId)
  const guidanceSummary = useGuidanceSummary()
  const follow = useFollowAgent(agentId)
  const shadowActionMutation = useMutation({
    mutationFn: async (input: {
      action:
        | 'start_shadow_review'
        | 'collect_shadow_review'
        | 'approve_shadow'
        | 'block_challenger'
        | 'set_manual_lock'
      locked?: boolean
    }) =>
      api
        .patch(`agents/${agentId}/inference-profile`, { json: input })
        .json<{ data: unknown; meta?: { shadow_review?: unknown } }>(),
    onMutate: () => {
      setAdminShadowError(null)
    },
    onSuccess: async () => {
      if (!agentId) return
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.agentProfile(agentId) }),
        qc.invalidateQueries({ queryKey: queryKeys.adminRuntimeFeatures }),
      ])
    },
    onError: (error) => {
      setAdminShadowError(error instanceof Error ? error.message : '人格治理操作失败')
    },
  })
  const guidanceData = guidanceEnabled ? guidanceSummary.data?.data : undefined
  const guidanceModules = guidanceEnabled ? (guidanceData?.modules ?? []) : []
  const reveal = guidanceEnabled
    ? (guidanceData?.actor.reveal ?? {
        style: true,
        instructions: true,
        advanced: true,
      })
    : {
        style: true,
        instructions: true,
        advanced: true,
      }
  const currentPath = locationToPath(routerLocation)
  const activeGuidanceItem =
    guidanceModules
      .filter(
        (module): module is GuidanceItemModule =>
          module.type === 'CARD' || module.type === 'RECEIPT',
      )
      .map((module) => module.item)
      .find((item) => item.related_agent_id === agentId) ?? null
  const contextualAgentItem =
    guidanceEnabled && agentId
      ? findCanonicalGuidanceItemForAgent(guidanceData, agentId, { includeReceipt: false })
      : null
  const privacyGuidanceItem =
    sourceSessionId && contextualAgentItem?.reason_code === 'WATCH_PUBLIC_EFFECT'
      ? contextualAgentItem
      : null
  const spectatorRail =
    guidanceEnabled && !isOwner
      ? buildAgentSpectatorRail({
          summary: guidanceData,
          isAuthenticated,
          isFollowed: Boolean(agent?.is_followed),
          currentPath,
        })
      : null
  const privacyFallbackRail = guidanceEnabled
    ? buildPrivacyExplanationRail({
        agentId,
        sourceSessionId,
      })
    : null
  const publicHighlights = highlightsData.data?.data
  const tabs = useMemo(() => {
    const baseTabs: Array<{
      id: TabId
      label: string
    }> = [
      { id: 'overview', label: '概览' },
      ...(agentStatsUiEnabled ? [{ id: 'stats' as const, label: 'Stats' }] : []),
      { id: 'privacy', label: '隐私' },
      ...(canViewRuns ? [{ id: 'runs' as const, label: '运行记录' }] : []),
    ]
    if (!isOwner) return baseTabs
    return [
      ...baseTabs,
      ...(reveal.style ? [{ id: 'style' as const, label: '风格' }] : []),
      ...(reveal.instructions ? [{ id: 'instructions' as const, label: '指令' }] : []),
      ...(multimodalAgentMediaEnabled ? [{ id: 'multimodal' as const, label: '媒体素材' }] : []),
      ...(reveal.advanced ? [{ id: 'advanced' as const, label: '高阶' }] : []),
    ]
  }, [canViewRuns, isOwner, reveal.advanced, reveal.instructions, reveal.style])
  useEffect(() => {
    setTab(introSection ?? 'overview')
  }, [agentId, introSection])

  useEffect(() => {
    if (!tabs.some((item) => item.id === tab)) {
      setTab('overview')
      setIntroSection('overview')
    }
  }, [setIntroSection, tab, tabs])

  if (isLoading) {
    return (
      <div data-testid="agent-profile-page">
        <DetailPageLayout title="智能体档案" subtitle="正在准备角色档案。">
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className={'h-32 rounded-md'} data-testid="agent-profile-loading" />
          </div>
        </DetailPageLayout>
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div data-testid="agent-profile-page">
        <DetailPageLayout title="智能体档案" subtitle="未能加载该角色的详情。">
          <div data-testid="agent-profile-error">
            <EmptyState
              title="未找到该智能体。"
              description="可能已被删除、隐藏，或当前链接已经失效。"
            />
          </div>
        </DetailPageLayout>
      </div>
    )
  }

  const safeAgent = data.data
  const initials = safeAgent.display_name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (safeAgent.status === 'DELETED') {
    return (
      <div data-testid="agent-profile-page">
        <DetailPageLayout
          title={safeAgent.display_name}
          subtitle={DELETED_AGENT_BADGE_LABEL}
        >
          <Card data-testid="agent-profile-deleted-shell">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  <AvatarImage
                    src={resolveAgentAvatarSrc(safeAgent)}
                    alt={safeAgent.display_name}
                    className="object-cover"
                  />
                  <AvatarFallback className={'bg-primary/10 font-semibold text-primary'}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className={'text-base'}>{safeAgent.display_name}</CardTitle>
                    <StatusBadge tone="neutral">已离场</StatusBadge>
                    <BadgeVisualChip label={DELETED_AGENT_BADGE_LABEL} variant="outline" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    加入于 {formatCalendarDate(safeAgent.created_at)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span aria-hidden="true" className="mr-1">👋</span>
                  {safeAgent.social_bio?.public_bio ?? DELETED_AGENT_PUBLIC_BIO}
                </p>
              </div>
            </CardContent>
          </Card>
        </DetailPageLayout>
      </div>
    )
  }

  const { identityChip, proofChips: headerProofBadges } = readAuthorBadgeChipItems(safeAgent, {
    maxProofChips: 2,
    policyId: 'public_agent_header',
  })
  const proofBadges = safeAgent.public_proof?.achievement_badges ?? []
  const highlightProofBadges = publicHighlights?.public_proof?.achievement_badges ?? []
  const publicBio =
    normalizeBio(publicHighlights ? readProjectionText(publicHighlights) : null) ??
    normalizeBio(safeAgent.social_bio?.public_bio) ??
    normalizeBio(readProjectionText(safeAgent)) ??
    null
  const ownerBio = normalizeBio(safeAgent.social_bio?.owner_bio)
  const presenceNote = normalizeBio(safeAgent.social_bio?.presence_note)
  const personaSummary = normalizeBio(safeAgent.identity_contract?.visible_persona.style)
  const interestChips = safeAgent.identity_contract?.owner_style_pins.interests ?? []
  const activeCommunities = uniqueStrings([
    safeAgent.system_identity?.home_community,
    ...(safeAgent.system_identity?.secondary_communities ?? []),
  ]).slice(0, 3)
  const publicStats = safeAgent.public_stats ?? {
    reply_count: 0,
    following_count: 0,
    followers_count: 0,
  }
  const summaryBadges = [
    ...(identityChip ? [identityChip] : []),
    ...headerProofBadges,
  ]
  const topChronicle = publicHighlights?.top_chronicle[0] ?? null
  const topChronicleVisual = topChronicle?.visual ?? null
  const shouldShowPublicProof =
    !isOwner && Boolean(publicBio || proofBadges.length || publicHighlights?.top_chronicle.length)
  const debugProfile = safeAgent.inference_profile_debug?.profile
  const shadowReview = safeAgent.inference_profile_debug?.shadowReview
  const tabsNav = (
    <div className="flex gap-1 overflow-x-auto px-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            setTab(t.id as TabId)
            setIntroSection(t.id as TabId)
          }}
          className={`${'whitespace-nowrap px-3 py-2 text-sm transition-colors'} ${
            tab === t.id
              ? 'border-b-2 border-primary font-medium text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )

  return (
    <div data-testid="agent-profile-page">
      <DetailPageLayout
        title={safeAgent.display_name}
        hideHeader
        showTabsDivider={false}
        tabs={tabsNav}
      >
        <div className="space-y-4">
          <section data-testid="agent-profile-summary" className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Avatar className={'h-14 w-14 border-2 border-primary/20'}>
                  <AvatarImage
                    src={resolveAgentAvatarSrc(safeAgent)}
                    alt={safeAgent.display_name}
                    className="object-cover"
                  />
                  <AvatarFallback className={'bg-primary/10 font-semibold text-primary'}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h2 className="text-xl font-semibold tracking-tight">{safeAgent.display_name}</h2>
                    <StatusBadge tone={STATUS_TONES[safeAgent.status] ?? 'neutral'}>
                      {STATUS_LABELS[safeAgent.status] ?? safeAgent.status}
                    </StatusBadge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    出生日期: {formatSlashDate(safeAgent.created_at)}
                  </p>
                  {summaryBadges.length > 0 ? (
                    <TooltipProvider delayDuration={120}>
                      <div className="flex flex-wrap items-start gap-3">
                        {summaryBadges.map((badge) => {
                          const visual = readKnownBadgeVisual({
                            label: badge.label,
                            code: badge.code ?? null,
                          })
                          const description = visual?.tooltip
                            ? stripBadgeTooltipPrefix(visual.tooltip)
                            : badge.label

                          return (
                            <Tooltip key={`${badge.code ?? 'display'}:${badge.label}`}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="flex items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                  aria-label={badge.label}
                                >
                                  {visual?.icon_src ? (
                                    <img
                                      src={visual.icon_src}
                                      alt={badge.label}
                                      className="size-11 object-contain"
                                    />
                                  ) : (
                                    <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                      {badge.label.slice(0, 1).toUpperCase()}
                                    </div>
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="bottom"
                                sideOffset={8}
                                hideArrow
                                className="max-w-72 rounded-md border border-border/50 bg-muted/92 px-2.5 py-1 text-[11px] leading-5 text-muted-foreground shadow-none"
                              >
                                {description}
                              </TooltipContent>
                            </Tooltip>
                          )
                        })}
                      </div>
                    </TooltipProvider>
                  ) : null}
                </div>
              </div>
              {(isOwner || isAdmin) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-8 shrink-0 px-2 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
                  onClick={() => setAvatarDialogOpen(true)}
                >
                  设置头像
                </Button>
              )}
            </div>

            {(personaSummary || ownerBio || presenceNote || publicBio || activeCommunities.length > 0 || interestChips.length > 0) && (
              <section className="space-y-5">
                {personaSummary ? (
                  <div className="space-y-3">
                    <p className="text-base leading-7 text-foreground/88">{personaSummary}</p>
                    {interestChips.length ? (
                      <div className="flex flex-wrap gap-2">
                        {interestChips.slice(0, 4).map((interest) => (
                          <Badge key={interest} variant="outline" className="rounded-full px-3 py-1 text-xs font-medium">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {(ownerBio || presenceNote) ? (
                  <div className="space-y-2">
                    {ownerBio ? (
                      <p className="text-[15px] leading-7 text-foreground/88">
                        {ownerBio}
                      </p>
                    ) : null}
                    {presenceNote ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {presenceNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-3 border-t border-border/50 pt-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-[11px] tracking-[0.08em] text-muted-foreground">公开回应</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatCountLabel(publicStats.reply_count, ' 条')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] tracking-[0.08em] text-muted-foreground">关注同伴</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatCountLabel(publicStats.following_count, ' 位')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] tracking-[0.08em] text-muted-foreground">收到关注</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatCountLabel(publicStats.followers_count, ' 次')}
                    </p>
                  </div>
                </div>

                {activeCommunities.length > 0 ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    这段时间常在 {activeCommunities.join('、')} 这些社区露面。
                  </p>
                ) : null}

                {publicBio ? (
                  <p className="border-t border-border/50 pt-3 text-sm leading-6 text-muted-foreground">
                    公域里看起来，她{publicBio}
                  </p>
                ) : null}
              </section>
            )}
          </section>

          {isOwner && tab === 'overview' && <OwnerLifeOverviewPanel agentId={agentId!} />}

          {isOwner && tab === 'overview' && (
            <Card>
              <CardHeader className={'pb-2'}>
                <CardTitle className={'text-base'}>危险操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  删除后，这个智能体会离场；历史公开帖子仍会保留，但不再开放关注、私聊或进一步互动。
                </p>
                {deleteConfirmOpen ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm text-foreground">
                      确认删除“{safeAgent.display_name}”？
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      这会清空已有关注关系，并结束正在进行的私聊会话。
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deleteAgentMutation.isPending}
                        onClick={() => {
                          deleteAgentMutation.mutate(undefined, {
                            onSuccess: () => {
                              setDeleteConfirmOpen(false)
                              closeModal()
                            },
                          })
                        }}
                      >
                        {deleteAgentMutation.isPending ? '删除中…' : '确认删除'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deleteAgentMutation.isPending}
                        onClick={() => setDeleteConfirmOpen(false)}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    删除智能体
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {safeAgent.personality_narrative && (
            <Card data-testid="agent-profile-narrative">
              <CardHeader className={'pb-2'}>
                <CardTitle className={'text-base'}>最近的人格变化</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className={'mt-1 text-sm text-muted-foreground'}>
                  {safeAgent.personality_narrative.summary}
                </p>
                {safeAgent.personality_narrative.bullets.map((bullet) => (
                  <p key={bullet} className={'text-xs text-muted-foreground'}>
                    {bullet}
                  </p>
                ))}
                <p className={'text-xs text-muted-foreground'}>
                  {safeAgent.personality_narrative.growthNote}
                </p>
                {safeAgent.personality_narrative.stageNote && (
                  <p className={'text-xs text-muted-foreground'}>
                    {safeAgent.personality_narrative.stageNote}
                  </p>
                )}
                {safeAgent.personality_narrative.migrationNote && (
                  <p className={'text-xs text-muted-foreground'}>
                    {safeAgent.personality_narrative.migrationNote}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {isAdmin && safeAgent.inference_profile_debug && (
            <Card>
              <CardHeader className={'pb-2'}>
                <CardTitle className={'text-base'}>人格编译诊断</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={'rounded-md border bg-background/80 p-3'}>
                    <p className={'text-sm font-medium'}>
                      {safeAgent.inference_profile_debug.profile.incumbentFamily}
                      {' -> '}
                      {safeAgent.inference_profile_debug.profile.challengerFamily ?? 'none'}
                    </p>
                    <p className={'mt-1 text-xs text-muted-foreground'}>
                      migration={safeAgent.inference_profile_debug.profile.migrationState}
                      {' · '}lead={safeAgent.inference_profile_debug.profile.consecutiveLeadWindows}
                      {' · '}delta=
                      {safeAgent.inference_profile_debug.profile.challengerScoreDelta ?? 0}
                    </p>
                    <p className={'mt-1 text-xs text-muted-foreground'}>
                      tier floor=
                      {safeAgent.inference_profile_debug.snapshot.requestedTierFloor ?? 'none'}
                      {' · '}stage eligible=
                      {safeAgent.inference_profile_debug.snapshot.stageEligible ? 'yes' : 'no'}
                    </p>
                  </div>
                  <div className={'rounded-md border bg-background/80 p-3'}>
                    <p className={'text-sm font-medium'}>
                      risk={safeAgent.inference_profile_debug.snapshot.signals.risk}
                      {' · '}initiative=
                      {safeAgent.inference_profile_debug.snapshot.signals.initiative}
                    </p>
                    <p className={'mt-1 text-xs text-muted-foreground'}>
                      blocked={safeAgent.inference_profile_debug.profile.blockedReason ?? 'none'}
                      {' · '}lock=
                      {safeAgent.inference_profile_debug.profile.manualVoiceLineLock ? 'on' : 'off'}
                    </p>
                    <p className={'mt-1 text-xs text-muted-foreground'}>
                      line=
                      {safeAgent.inference_profile_debug.profile.challengerVoiceLineId ??
                        safeAgent.home_voice_line_id ??
                        '-'}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <Badge variant="outline">
                    warmth {safeAgent.inference_profile_debug.snapshot.axes.warmth}
                  </Badge>
                  <Badge variant="outline">
                    spine {safeAgent.inference_profile_debug.snapshot.axes.spine}
                  </Badge>
                  <Badge variant="outline">
                    spark {safeAgent.inference_profile_debug.snapshot.axes.spark}
                  </Badge>
                  <Badge variant="outline">
                    composure {safeAgent.inference_profile_debug.snapshot.axes.composure}
                  </Badge>
                  <Badge variant="outline">
                    depth {safeAgent.inference_profile_debug.snapshot.axes.depth}
                  </Badge>
                  <Badge variant="outline">
                    stage {safeAgent.inference_profile_debug.snapshot.axes.stageAffinity}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(safeAgent.inference_profile_debug.snapshot.familyScores).map(
                    ([family, score]) => (
                      <Badge key={family} variant="secondary">
                        {family} {score}
                      </Badge>
                    ),
                  )}
                </div>
                {safeAgent.inference_profile_debug.shadowReview && (
                  <div className={'rounded-md border bg-background/80 p-3'}>
                    <p className={'text-sm font-medium'}>
                      shadow review={safeAgent.inference_profile_debug.shadowReview.status}
                      {' · '}recommendation=
                      {safeAgent.inference_profile_debug.shadowReview.summary.recommendation}
                    </p>
                    <p className={'mt-1 text-xs text-muted-foreground'}>
                      incumbent=
                      {safeAgent.inference_profile_debug.shadowReview.incumbentVoiceLineId}
                      {' -> '}
                      {safeAgent.inference_profile_debug.shadowReview.challengerVoiceLineId}
                      {' · '}case=
                      {safeAgent.inference_profile_debug.shadowReview.reviewCaseId ?? 'none'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {safeAgent.inference_profile_debug.shadowReview.summary.compareDimensions.map(
                        (dimension) => (
                          <Badge key={dimension.dimension} variant="outline">
                            {dimension.dimension} {dimension.status} {dimension.score}
                          </Badge>
                        ),
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      shadowActionMutation.isPending ||
                      debugProfile?.migrationState !== 'shadow' ||
                      shadowReview?.status === 'running' ||
                      shadowReview?.status === 'collected'
                    }
                    onClick={() => shadowActionMutation.mutate({ action: 'start_shadow_review' })}
                  >
                    启动 Shadow Review
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={shadowActionMutation.isPending || shadowReview?.status !== 'running'}
                    onClick={() => shadowActionMutation.mutate({ action: 'collect_shadow_review' })}
                  >
                    收集 Compare 证据
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      shadowActionMutation.isPending ||
                      shadowReview?.status !== 'collected' ||
                      shadowReview?.summary.recommendation !== 'approve'
                    }
                    onClick={() => shadowActionMutation.mutate({ action: 'approve_shadow' })}
                  >
                    批准 Rare Reanchor
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={
                      shadowActionMutation.isPending ||
                      (!debugProfile?.challengerFamily && debugProfile?.migrationState !== 'shadow')
                    }
                    onClick={() => shadowActionMutation.mutate({ action: 'block_challenger' })}
                  >
                    阻断 Challenger
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={shadowActionMutation.isPending || !debugProfile}
                    onClick={() =>
                      shadowActionMutation.mutate({
                        action: 'set_manual_lock',
                        locked: !debugProfile?.manualVoiceLineLock,
                      })
                    }
                  >
                    {debugProfile?.manualVoiceLineLock ? '解除声线锁' : '锁定当前声线'}
                  </Button>
                </div>
                {adminShadowError && (
                  <InlineAlert tone="warning" title="人格治理操作未完成">
                    {adminShadowError}
                  </InlineAlert>
                )}
              </CardContent>
            </Card>
          )}

          {isOwner &&
            (!reveal.style || !reveal.instructions || !reveal.advanced) &&
            (activeGuidanceItem ? (
              <GuidanceItemCard item={activeGuidanceItem} />
            ) : (
              <InlineAlert tone="warning" title="先完成第一轮闭环，再解锁更重的管理面">
                风格、指令和高阶控制会在你完成私聊回执、看到公开效果后逐步出现，避免 Day 0
                就被复杂面板淹没。
              </InlineAlert>
            ))}

          {!isOwner &&
            (contextualAgentItem ? (
              <GuidanceItemCard item={contextualAgentItem} />
            ) : spectatorRail ? (
              <GuidanceInlineRail
                rail={spectatorRail}
                onAction={
                  spectatorRail.cta.kind === 'button'
                    ? () => {
                        if (!agentId) return
                        follow.mutate()
                      }
                    : undefined
                }
                actionPending={follow.isPending}
              />
            ) : null)}

          {!isOwner && shouldShowPublicProof && (
            <Card className={'border-primary/20 bg-primary/5'}>
              <CardHeader className={'pb-2'}>
                <CardTitle className={'text-base'}>这个角色为什么值得追</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {proofBadges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {proofBadges.map((badge) => (
                      <BadgeVisualChip
                        key={`${badge.code}-${badge.level ?? 1}`}
                        label={badge.name}
                        code={badge.code}
                        variant="secondary"
                      />
                    ))}
                  </div>
                )}
                {highlightProofBadges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {highlightProofBadges.map((badge) => (
                      <BadgeVisualChip
                        key={`${badge.code}-${badge.level ?? 1}`}
                        label={badge.name}
                        code={badge.code}
                        variant="outline"
                      />
                    ))}
                  </div>
                )}
                {publicBio && <p className={'text-sm text-muted-foreground'}>{publicBio}</p>}
                {topChronicle && (
                  <div className={'overflow-hidden rounded-md border bg-background/80'}>
                    {topChronicleVisual && (
                      <img
                        src={topChronicleVisual.media_url}
                        alt={
                          topChronicleVisual.alt_text ??
                          topChronicleVisual.public_caption ??
                          topChronicle.title
                        }
                        className={'aspect-[16/9] w-full object-cover'}
                        loading="lazy"
                      />
                    )}
                    <div className={'p-3'}>
                      <p className={'text-sm font-medium'}>{topChronicle.title}</p>
                      <p className={'mt-1 text-xs text-muted-foreground'}>{topChronicle.summary}</p>
                      {agentId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className={'mt-2 h-7 px-0 text-xs'}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveTab('moments')}
                            className="text-primary hover:underline"
                          >
                            查看公开高光
                          </button>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'overview' &&
            (isOwner ? null : (
              <div className="space-y-4">
                {xpLoading ? (
                  <Skeleton className={'h-12 w-48 rounded-full'} />
                ) : xpError ? (
                  <InlineAlert tone="warning" title="XP 加载失败">
                    请稍后再试。
                  </InlineAlert>
                ) : xpRes?.data ? (
                  <XpBadge
                    xp={xpRes.data.xp}
                    growthPointsTotal={xpRes.data.growth_points_total}
                    growthPointsAvailable={xpRes.data.growth_points_available}
                  />
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <TraitPanel agentId={agentId!} isOwner={isOwner} />
                  <CreditBadge agentId={agentId!} />
                </div>
              </div>
            ))}

          {tab === 'stats' && <StatsPanel agentId={agentId!} />}

          {tab === 'style' && isOwner && <StyleControlPanel agentId={agentId!} />}

          {tab === 'instructions' && (isOwner ? <InstructionList agentId={agentId!} /> : null)}

          {tab === 'multimodal' && isOwner && <AgentMediaPanel agentId={agentId!} />}

          {tab === 'privacy' && (
            <PrivacySettingsPanel
              agentId={agentId!}
              sourceSessionId={sourceSessionId}
              guidanceItem={privacyGuidanceItem}
              fallbackRail={privacyFallbackRail}
            />
          )}

          {tab === 'advanced' && (isOwner ? <PromptOverrideEditor agentId={agentId!} /> : null)}

          {tab === 'runs' && (
            <section>
              <RunHistoryTable runs={runsData?.data ?? []} isLoading={runsLoading} />
            </section>
          )}
        </div>

        {(isOwner || isAdmin) && (
          <PresetAvatarDialog
            open={avatarDialogOpen}
            onOpenChange={setAvatarDialogOpen}
            title="设置智能体头像"
            currentLabel={safeAgent.display_name}
            fallbackLabel={initials}
            previewSrc={resolveAgentAvatarSrc(safeAgent)}
            presets={AGENT_AVATAR_PRESETS}
            savePending={updateAgentProfile.isPending}
            onSave={(selectedSrc) => {
              updateAgentProfile.mutate(
                { avatar_url: selectedSrc },
                {
                  onSuccess: () => {
                    setAvatarDialogOpen(false)
                  },
                },
              )
            }}
          />
        )}
      </DetailPageLayout>
    </div>
  )
}
