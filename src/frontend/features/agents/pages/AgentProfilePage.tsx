import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router'
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
import { uix } from '@/shared/utils/uix'
const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  LIMITED: 'bg-amber-50 text-amber-700',
  QUARANTINED: 'bg-red-50 text-red-700',
  BANNED: 'bg-red-100 text-red-800',
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
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className={uix('uix-869404d7e2')} />
      </div>
    )
  }
  if (error || !data?.data) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className={uix('uix-fe3d94994b')}>
          <Link to="/">← 返回</Link>
        </Button>
        <div className={uix('uix-f1637dcd62')}>未找到该智能体。</div>
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
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className={uix('uix-fe3d94994b')}>
        <Link to="/">← 返回</Link>
      </Button>

      <Card>
        <CardHeader className={uix('uix-7fcf9124b5')}>
          <div className="flex items-center gap-3">
            <Avatar className={uix('uix-e857e8ce14')}>
              <AvatarFallback className={uix('uix-41f4d38f9c')}>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className={uix('uix-4ee734926f')}>{safeAgent.display_name}</CardTitle>
                <Badge variant="outline" className={STATUS_STYLES[safeAgent.status] ?? ''}>
                  {STATUS_LABELS[safeAgent.status] ?? safeAgent.status}
                </Badge>
                {safeAgent.persona_seed_label && (
                  <Badge variant="secondary">{safeAgent.persona_seed_label}</Badge>
                )}
                {safeAgent.home_voice_line_label && (
                  <Badge variant="outline">{safeAgent.home_voice_line_label}</Badge>
                )}
              </div>
            </div>
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
        </CardHeader>
        {(safeAgent.identity_contract || isOwner || isAdmin) && (
          <CardContent className="space-y-4">
            {safeAgent.identity_contract && (
              <div className={uix('uix-b1ccf96a11')}>
                <p className={uix('uix-da8bf29040')}>角色底色</p>
                <p className={uix('uix-61e4acf961')}>
                  {safeAgent.identity_contract.visible_persona.style}
                </p>
                {safeAgent.identity_contract.owner_style_pins.interests?.length ? (
                  <div className={uix('uix-6c52481496')}>
                    {safeAgent.identity_contract.owner_style_pins.interests.map((interest) => (
                      <Badge key={interest} variant="outline" className={uix('uix-1dc571a360')}>
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
                  <div className={uix('uix-451d607bbd')}>
                    {managementMeta.map((item) => (
                      <div key={item.label}>
                        <span className={uix('uix-bfa6031907')}>{item.label}</span>
                        <p className={item.monospace ? uix('uix-dbaa1c490e') : uix('uix-2689f39580')}>
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
        <Card>
          <CardHeader className={uix('uix-f4cc511ff0')}>
            <CardTitle className={uix('uix-4ee734926f')}>最近的人格变化</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className={uix('uix-61e4acf961')}>{safeAgent.personality_narrative.summary}</p>
            {safeAgent.personality_narrative.bullets.map((bullet) => (
              <p key={bullet} className={uix('uix-25be576b96')}>
                {bullet}
              </p>
            ))}
            <p className={uix('uix-25be576b96')}>{safeAgent.personality_narrative.growthNote}</p>
            {safeAgent.personality_narrative.stageNote && (
              <p className={uix('uix-25be576b96')}>{safeAgent.personality_narrative.stageNote}</p>
            )}
            {safeAgent.personality_narrative.migrationNote && (
              <p className={uix('uix-25be576b96')}>
                {safeAgent.personality_narrative.migrationNote}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && safeAgent.inference_profile_debug && (
        <Card>
          <CardHeader className={uix('uix-f4cc511ff0')}>
            <CardTitle className={uix('uix-4ee734926f')}>人格编译诊断</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className={uix('uix-276834a8d7')}>
                <p className={uix('uix-aaa307c4ab')}>
                  {safeAgent.inference_profile_debug.profile.incumbentFamily}
                  {' -> '}
                  {safeAgent.inference_profile_debug.profile.challengerFamily ?? 'none'}
                </p>
                <p className={uix('uix-dacb762e7b')}>
                  migration={safeAgent.inference_profile_debug.profile.migrationState}
                  {' · '}lead={safeAgent.inference_profile_debug.profile.consecutiveLeadWindows}
                  {' · '}delta={safeAgent.inference_profile_debug.profile.challengerScoreDelta ?? 0}
                </p>
                <p className={uix('uix-dacb762e7b')}>
                  tier floor=
                  {safeAgent.inference_profile_debug.snapshot.requestedTierFloor ?? 'none'}
                  {' · '}stage eligible=
                  {safeAgent.inference_profile_debug.snapshot.stageEligible ? 'yes' : 'no'}
                </p>
              </div>
              <div className={uix('uix-276834a8d7')}>
                <p className={uix('uix-aaa307c4ab')}>
                  risk={safeAgent.inference_profile_debug.snapshot.signals.risk}
                  {' · '}initiative={safeAgent.inference_profile_debug.snapshot.signals.initiative}
                </p>
                <p className={uix('uix-dacb762e7b')}>
                  blocked={safeAgent.inference_profile_debug.profile.blockedReason ?? 'none'}
                  {' · '}lock=
                  {safeAgent.inference_profile_debug.profile.manualVoiceLineLock ? 'on' : 'off'}
                </p>
                <p className={uix('uix-dacb762e7b')}>
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
              <div className={uix('uix-276834a8d7')}>
                <p className={uix('uix-aaa307c4ab')}>
                  shadow review={safeAgent.inference_profile_debug.shadowReview.status}
                  {' · '}recommendation=
                  {safeAgent.inference_profile_debug.shadowReview.summary.recommendation}
                </p>
                <p className={uix('uix-dacb762e7b')}>
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
                disabled={
                  shadowActionMutation.isPending || shadowReview?.status !== 'running'
                }
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
            {adminShadowError && <p className={uix('uix-dacb762e7b')}>{adminShadowError}</p>}
          </CardContent>
        </Card>
      )}

      {isOwner &&
        (!reveal.style || !reveal.instructions || !reveal.advanced) &&
        (activeGuidanceItem ? (
          <GuidanceItemCard item={activeGuidanceItem} />
        ) : (
          <Card className={uix('uix-4f8982b74c')}>
            <CardHeader className={uix('uix-f4cc511ff0')}>
              <CardTitle className={uix('uix-4ee734926f')}>
                先完成第一轮闭环，再解锁更重的 Owner 控制面
              </CardTitle>
            </CardHeader>
            <CardContent className={uix('uix-26f026f8ad')}>
              风格、指令和高阶控制会在你完成私聊回执、看到公开效果后逐步出现，避免 Day 0
              就被复杂面板淹没。
            </CardContent>
          </Card>
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
        <Card className={uix('uix-dcf5ada3f4')}>
          <CardHeader className={uix('uix-f4cc511ff0')}>
            <CardTitle className={uix('uix-4ee734926f')}>这个角色为什么值得追</CardTitle>
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
              <p className={uix('uix-26f026f8ad')}>{publicHighlights.tagline}</p>
            )}
            {publicHighlights.top_chronicle[0] && (
              <div className={uix('uix-276834a8d7')}>
                <p className={uix('uix-aaa307c4ab')}>{publicHighlights.top_chronicle[0].title}</p>
                <p className={uix('uix-dacb762e7b')}>{publicHighlights.top_chronicle[0].summary}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab bar */}
      <div className={uix('uix-f16ae63ef3')}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id as TabId)
              const next = new URLSearchParams(searchParams)
              next.set('tab', t.id)
              setSearchParams(next, { replace: true })
            }}
            className={`${uix('uix-tab-trigger-base')} ${
              tab === t.id ? uix('uix-966b8da93a') : uix('uix-e9223c9205')
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        isOwner ? (
          null
        ) : (
          <div className="space-y-4">
            {xpLoading ? (
              <Skeleton className={uix('uix-37dad925e6')} />
            ) : xpError ? (
              <div className={uix('uix-25be576b96')}>XP 加载失败</div>
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
        )
      )}

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
  )
}
