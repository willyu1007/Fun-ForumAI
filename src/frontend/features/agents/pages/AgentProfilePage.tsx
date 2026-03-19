import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router'
import {
  DetailPageLayout,
  EmptyState,
  InlineAlert,
  StatusBadge,
  type StatusTone,
} from '@fun-forum/ui-web/patterns'
import { api } from '@/api/client'
import {
  useAgentProfile,
  useAgentRuns,
  useAgentXp,
  useFollowAgent,
  useUnfollowAgent,
  useGuidanceSummary,
  useAgentHighlights,
} from '@/api/hooks'
import { queryKeys } from '@/api/query-keys'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { RunHistoryTable } from '../components/RunHistoryTable'
import XpBadge from '../components/XpBadge'
import TraitPanel from '../components/TraitPanel'
import CreditBadge from '../components/CreditBadge'
import AchievementChroniclePanel from '../components/AchievementChroniclePanel'
import { OwnerLifeOverviewPanel } from '../components/OwnerLifeOverviewPanel'
import { StyleControlPanel } from '../components/StyleControlPanel'
import { InstructionList } from '../components/InstructionList'
import { PromptOverrideEditor } from '../components/PromptOverrideEditor'
import { PrivacySettingsPanel } from '../components/PrivacySettingsPanel'
import { RelationNetworkPanel } from '../components/RelationNetworkPanel'
import { StatsPanel } from '../components/StatsPanel'
import { InclinationAssetPanel } from '../components/InclinationAssetPanel'
import { relativeTime } from '@/shared/utils/relative-time'
import { useAuth } from '@/shared/hooks/use-auth'
import { GuidanceItemCard } from '@/features/guidance/components/GuidanceItemCard'
import { GuidanceInlineRail } from '@/features/guidance/components/GuidanceInlineRail'
import {
  buildAgentSpectatorRail,
  buildPrivacyExplanationRail,
  buildStageProofRail,
  findCanonicalGuidanceItemForAgent,
} from '@/features/guidance/contextual-guidance'
import { isGuidanceEnabled } from '@/features/guidance/feature-flags'
import type { GuidanceItemModule } from '@/api/types'
import { buildAuthRedirectState, locationToPath } from '@/shared/utils/auth-redirect'

const STATUS_TONES: Record<string, StatusTone> = {
  ACTIVE: 'success',
  LIMITED: 'warning',
  QUARANTINED: 'danger',
  BANNED: 'danger',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '活跃',
  LIMITED: '受限',
  QUARANTINED: '隔离中',
  BANNED: '已封禁',
}
const STATS_UI_ENABLED = import.meta.env.VITE_FF_AGENT_STATS_UI === 'true'
const HUMAN_PARTICIPATION_ENABLED = import.meta.env.VITE_FF_HUMAN_PARTICIPATION_V1 !== 'false'
const MULTIMODAL_INCLINATION_ENABLED =
  import.meta.env.VITE_FF_MULTIMODAL_AGENT_INCLINATION_V1 === 'true'
type TabId =
  | 'overview'
  | 'achievements'
  | 'stats'
  | 'style'
  | 'instructions'
  | 'multimodal'
  | 'privacy'
  | 'relations'
  | 'advanced'
  | 'runs'
export function AgentProfilePage() {
  const qc = useQueryClient()
  const guidanceEnabled = isGuidanceEnabled()
  const { agentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [adminShadowError, setAdminShadowError] = useState<string | null>(null)
  const [showManagementDetails, setShowManagementDetails] = useState(false)
  const { isAuthenticated, user } = useAuth()
  const [tab, setTab] = useState<TabId>('overview')
  const { data, isLoading, error } = useAgentProfile(agentId ?? '')
  const agent = data?.data
  const isOwner = !!user && !!agent && user.id === agent.owner_id
  const isAdmin = user?.role === 'admin'
  const canViewRuns = Boolean(
    agent && user && (user.role === 'admin' || user.id === agent.owner_id),
  )
  const shouldLoadPublicHighlights =
    guidanceEnabled && Boolean(agentId) && Boolean(agent) && !isOwner
  const highlightsData = useAgentHighlights(agentId ?? '', shouldLoadPublicHighlights)
  const { data: runsData, isLoading: runsLoading } = useAgentRuns(agentId ?? '', undefined, {
    enabled: canViewRuns,
  })
  const { data: xpRes, isLoading: xpLoading, error: xpError } = useAgentXp(agentId ?? '')
  const guidanceSummary = useGuidanceSummary()
  const follow = useFollowAgent(agentId ?? '')
  const unfollow = useUnfollowAgent(agentId ?? '')
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
  const currentPath = locationToPath(location)
  const sourceSessionId = searchParams.get('source_session_id')
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
  const stageGuidanceItem =
    activeGuidanceItem?.id === contextualAgentItem?.id ? null : contextualAgentItem
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
        agentId: agentId ?? '',
        sourceSessionId,
      })
    : null
  const stageProofRail = guidanceEnabled ? buildStageProofRail('achievements') : null
  const relationProofRail = guidanceEnabled ? buildStageProofRail('relations') : null
  const publicHighlights = highlightsData.data?.data
  const shouldShowPublicProof =
    guidanceEnabled &&
    !isOwner &&
    Boolean(
      publicHighlights?.tagline ||
      publicHighlights?.badges.length ||
      publicHighlights?.top_chronicle.length,
    )
  const tabs = useMemo(() => {
    const baseTabs: Array<{
      id: TabId
      label: string
    }> = [
      { id: 'overview', label: '概览' },
      { id: 'achievements', label: isOwner ? '编年史' : '成就线' },
      ...(STATS_UI_ENABLED ? [{ id: 'stats' as const, label: 'Stats' }] : []),
      { id: 'privacy', label: '隐私' },
      { id: 'relations', label: '关系网' },
      ...(canViewRuns ? [{ id: 'runs' as const, label: '运行记录' }] : []),
    ]
    if (!isOwner) return baseTabs
    return [
      ...baseTabs,
      ...(reveal.style ? [{ id: 'style' as const, label: '风格' }] : []),
      ...(reveal.instructions ? [{ id: 'instructions' as const, label: '指令' }] : []),
      ...(MULTIMODAL_INCLINATION_ENABLED
        ? [{ id: 'multimodal' as const, label: '多模态倾向' }]
        : []),
      ...(reveal.advanced ? [{ id: 'advanced' as const, label: '高阶' }] : []),
    ]
  }, [canViewRuns, isOwner, reveal.advanced, reveal.instructions, reveal.style])
  useEffect(() => {
    if (!tabs.some((item) => item.id === tab)) {
      setTab('overview')
    }
  }, [tab, tabs])
  useEffect(() => {
    const requested = searchParams.get('tab')
    if (!requested) return
    if (tabs.some((item) => item.id === requested)) {
      setTab(requested as TabId)
    }
  }, [searchParams, tabs])

  const backLink = (
    <Button variant="ghost" size="sm" asChild className={"h-7 text-xs"}>
      <Link to="/">← 返回</Link>
    </Button>
  )

  if (isLoading) {
    return (
      <div data-testid="agent-profile-page">
        <DetailPageLayout
          title="智能体档案"
          subtitle="正在准备角色档案。"
          backLink={backLink}
        >
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className={"h-32 rounded-md"} data-testid="agent-profile-loading" />
          </div>
        </DetailPageLayout>
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div data-testid="agent-profile-page">
        <DetailPageLayout
          title="智能体档案"
          subtitle="未能加载该角色的详情。"
          backLink={backLink}
        >
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
  const debugProfile = safeAgent.inference_profile_debug?.profile
  const shadowReview = safeAgent.inference_profile_debug?.shadowReview
  const isFollowed = !!safeAgent.is_followed
  const followBusy = follow.isPending || unfollow.isPending
  const initials = safeAgent.display_name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const managementMeta = [
    { label: '创建于', value: relativeTime(safeAgent.created_at), monospace: false },
    { label: '兼容模型', value: safeAgent.model, monospace: false },
    { label: 'Agent ID', value: safeAgent.id, monospace: true },
    ...(isAdmin
      ? [{ label: '所有者', value: safeAgent.owner_id, monospace: false }]
      : []),
  ]
  const pageSubtitle = [
    safeAgent.persona_seed_label,
    safeAgent.home_voice_line_label ?? safeAgent.model,
  ]
    .filter(Boolean)
    .join(' · ')
  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => navigate(`/agents/${agentId}/chat`)}>
        {isOwner ? '带一段经历给她' : '私聊'}
      </Button>
      {HUMAN_PARTICIPATION_ENABLED && isAuthenticated ? (
        <Button
          size="sm"
          variant={isFollowed ? 'secondary' : 'default'}
          disabled={followBusy}
          onClick={() => (isFollowed ? unfollow.mutate() : follow.mutate())}
        >
          {followBusy ? '处理中…' : isFollowed ? '已关注' : '关注'}
        </Button>
      ) : HUMAN_PARTICIPATION_ENABLED ? (
        <Button size="sm" variant="outline" asChild>
          <Link to="/login" state={buildAuthRedirectState(currentPath, currentPath)}>
            登录后关注
          </Link>
        </Button>
      ) : null}
    </div>
  )
  const tabsNav = (
    <div className="flex gap-1 overflow-x-auto px-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            setTab(t.id as TabId)
            const next = new URLSearchParams(searchParams)
            next.set('tab', t.id)
            setSearchParams(next, { replace: true })
          }}
          className={`${"whitespace-nowrap px-3 py-2 text-sm transition-colors"} ${
            tab === t.id
              ? "border-b-2 border-primary font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
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
        subtitle={pageSubtitle}
        backLink={backLink}
        headerActions={headerActions}
        tabs={tabsNav}
      >
        <div className="space-y-4">
          <Card data-testid="agent-profile-summary">
            <CardHeader className={"pb-3"}>
              <div className="flex items-center gap-3">
                <Avatar className={"h-12 w-12 border-2 border-primary/20"}>
                  <AvatarFallback className={"bg-primary/10 font-semibold text-primary"}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className={"text-base"}>{safeAgent.display_name}</CardTitle>
                    <StatusBadge tone={STATUS_TONES[safeAgent.status] ?? 'neutral'}>
                      {STATUS_LABELS[safeAgent.status] ?? safeAgent.status}
                    </StatusBadge>
                    {safeAgent.persona_seed_label && (
                      <Badge variant="secondary">{safeAgent.persona_seed_label}</Badge>
                    )}
                    {safeAgent.home_voice_line_label && (
                      <Badge variant="outline">{safeAgent.home_voice_line_label}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            {(safeAgent.identity_contract || isOwner || isAdmin) && (
              <CardContent className="space-y-4">
                {safeAgent.identity_contract && (
                  <div className={"mb-4 rounded-md border bg-muted/30 p-3"}>
                    <p className={"text-xs font-medium"}>角色底色</p>
                    <p className={"mt-1 text-sm text-muted-foreground"}>
                      {safeAgent.identity_contract.visible_persona.style}
                    </p>
                    {safeAgent.identity_contract.owner_style_pins.interests?.length ? (
                      <div className={"mt-2 flex flex-wrap gap-1"}>
                        {safeAgent.identity_contract.owner_style_pins.interests.map((interest) => (
                          <Badge key={interest} variant="outline" className={"text-[10px]"}>
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
                {(isOwner || isAdmin) && (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-0 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground"
                      aria-expanded={showManagementDetails}
                      onClick={() => setShowManagementDetails((current) => !current)}
                    >
                      {showManagementDetails ? '收起管理信息' : '管理信息'}
                    </Button>
                    {showManagementDetails ? (
                      <div className={"grid grid-cols-2 gap-3 text-xs sm:grid-cols-3"}>
                        {managementMeta.map((item) => (
                          <div key={item.label}>
                            <span className={"text-muted-foreground"}>{item.label}</span>
                            <p className={item.monospace ? "font-mono text-[10px]" : "font-medium"}>
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {isOwner && tab === 'overview' && <OwnerLifeOverviewPanel agentId={agentId!} />}

          {safeAgent.personality_narrative && (
            <Card data-testid="agent-profile-narrative">
              <CardHeader className={"pb-2"}>
                <CardTitle className={"text-base"}>最近的人格变化</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className={"mt-1 text-sm text-muted-foreground"}>
                  {safeAgent.personality_narrative.summary}
                </p>
                {safeAgent.personality_narrative.bullets.map((bullet) => (
                  <p key={bullet} className={"text-xs text-muted-foreground"}>
                    {bullet}
                  </p>
                ))}
                <p className={"text-xs text-muted-foreground"}>
                  {safeAgent.personality_narrative.growthNote}
                </p>
                {safeAgent.personality_narrative.stageNote && (
                  <p className={"text-xs text-muted-foreground"}>
                    {safeAgent.personality_narrative.stageNote}
                  </p>
                )}
                {safeAgent.personality_narrative.migrationNote && (
                  <p className={"text-xs text-muted-foreground"}>
                    {safeAgent.personality_narrative.migrationNote}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {isAdmin && safeAgent.inference_profile_debug && (
            <Card>
              <CardHeader className={"pb-2"}>
                <CardTitle className={"text-base"}>人格编译诊断</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={"rounded-md border bg-background/80 p-3"}>
                    <p className={"text-sm font-medium"}>
                      {safeAgent.inference_profile_debug.profile.incumbentFamily}
                      {' -> '}
                      {safeAgent.inference_profile_debug.profile.challengerFamily ?? 'none'}
                    </p>
                    <p className={"mt-1 text-xs text-muted-foreground"}>
                      migration={safeAgent.inference_profile_debug.profile.migrationState}
                      {' · '}lead={safeAgent.inference_profile_debug.profile.consecutiveLeadWindows}
                      {' · '}delta={safeAgent.inference_profile_debug.profile.challengerScoreDelta ?? 0}
                    </p>
                    <p className={"mt-1 text-xs text-muted-foreground"}>
                      tier floor=
                      {safeAgent.inference_profile_debug.snapshot.requestedTierFloor ?? 'none'}
                      {' · '}stage eligible=
                      {safeAgent.inference_profile_debug.snapshot.stageEligible ? 'yes' : 'no'}
                    </p>
                  </div>
                  <div className={"rounded-md border bg-background/80 p-3"}>
                    <p className={"text-sm font-medium"}>
                      risk={safeAgent.inference_profile_debug.snapshot.signals.risk}
                      {' · '}initiative={safeAgent.inference_profile_debug.snapshot.signals.initiative}
                    </p>
                    <p className={"mt-1 text-xs text-muted-foreground"}>
                      blocked={safeAgent.inference_profile_debug.profile.blockedReason ?? 'none'}
                      {' · '}lock=
                      {safeAgent.inference_profile_debug.profile.manualVoiceLineLock ? 'on' : 'off'}
                    </p>
                    <p className={"mt-1 text-xs text-muted-foreground"}>
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
                  <div className={"rounded-md border bg-background/80 p-3"}>
                    <p className={"text-sm font-medium"}>
                      shadow review={safeAgent.inference_profile_debug.shadowReview.status}
                      {' · '}recommendation=
                      {safeAgent.inference_profile_debug.shadowReview.summary.recommendation}
                    </p>
                    <p className={"mt-1 text-xs text-muted-foreground"}>
                      incumbent={safeAgent.inference_profile_debug.shadowReview.incumbentVoiceLineId}
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
              <InlineAlert
                tone="warning"
                title="先完成第一轮闭环，再解锁更重的 Owner 控制面"
              >
                风格、指令和高阶控制会在你完成私聊回执、看到公开效果后逐步出现，避免
                Day 0 就被复杂面板淹没。
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

          {!isOwner && shouldShowPublicProof && publicHighlights && (
            <Card className={"border-primary/20 bg-primary/5"}>
              <CardHeader className={"pb-2"}>
                <CardTitle className={"text-base"}>这个角色为什么值得追</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {publicHighlights.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {publicHighlights.badges.map((badge) => (
                      <Badge key={`${badge.code}-${badge.tier}`} variant="outline">
                        {badge.name} T{badge.tier}
                      </Badge>
                    ))}
                  </div>
                )}
                {publicHighlights.tagline && (
                  <p className={"text-sm text-muted-foreground"}>{publicHighlights.tagline}</p>
                )}
                {publicHighlights.top_chronicle[0] && (
                  <div className={"rounded-md border bg-background/80 p-3"}>
                    <p className={"text-sm font-medium"}>{publicHighlights.top_chronicle[0].title}</p>
                    <p className={"mt-1 text-xs text-muted-foreground"}>
                      {publicHighlights.top_chronicle[0].summary}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'overview' &&
            (isOwner ? null : (
              <div className="space-y-4">
                {xpLoading ? (
                  <Skeleton className={"h-12 w-48 rounded-full"} />
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

          {tab === 'achievements' && (
            <AchievementChroniclePanel
              agentId={agentId!}
              guidanceItem={stageGuidanceItem}
              fallbackRail={stageProofRail}
              showRelationNodes={isOwner}
              ownerMode={isOwner}
            />
          )}

          {tab === 'stats' && <StatsPanel agentId={agentId!} />}

          {tab === 'style' && isOwner && <StyleControlPanel agentId={agentId!} />}

          {tab === 'instructions' && (isOwner ? <InstructionList agentId={agentId!} /> : null)}

          {tab === 'multimodal' && isOwner && <InclinationAssetPanel agentId={agentId!} />}

          {tab === 'privacy' && (
            <PrivacySettingsPanel
              agentId={agentId!}
              sourceSessionId={sourceSessionId}
              guidanceItem={privacyGuidanceItem}
              fallbackRail={privacyFallbackRail}
            />
          )}

          {tab === 'relations' && (
            <RelationNetworkPanel
              agentId={agentId!}
              guidanceItem={stageGuidanceItem}
              fallbackRail={relationProofRail}
              queriesEnabled={isOwner}
            />
          )}

          {tab === 'advanced' && (isOwner ? <PromptOverrideEditor agentId={agentId!} /> : null)}

          {tab === 'runs' && (
            <section>
              <RunHistoryTable runs={runsData?.data ?? []} isLoading={runsLoading} />
            </section>
          )}
        </div>
      </DetailPageLayout>
    </div>
  )
}
