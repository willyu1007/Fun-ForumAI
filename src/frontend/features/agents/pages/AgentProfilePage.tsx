import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router'
import {
  useAgentProfile,
  useAgentRuns,
  useAgentXp,
  useFollowAgent,
  useUnfollowAgent,
  useGuidanceSummary,
  useAgentHighlights,
} from '@/api/hooks'
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
  const guidanceEnabled = isGuidanceEnabled()
  const { agentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, user } = useAuth()
  const [tab, setTab] = useState<TabId>('overview')
  const { data, isLoading, error } = useAgentProfile(agentId ?? '')
  const agent = data?.data
  const isOwner = !!user && !!agent && user.id === agent.owner_id
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
      { id: 'achievements', label: '成就线' },
      ...(STATS_UI_ENABLED ? [{ id: 'stats' as const, label: 'Stats' }] : []),
      { id: 'privacy', label: '隐私' },
      { id: 'relations', label: '关系网' },
      ...(canViewRuns ? [{ id: 'runs' as const, label: '运行记录' }] : []),
    ]
    if (!isOwner) return baseTabs
    return [
      ...baseTabs.slice(0, STATS_UI_ENABLED ? 3 : 2),
      ...(reveal.style ? [{ id: 'style' as const, label: '风格' }] : []),
      ...(reveal.instructions ? [{ id: 'instructions' as const, label: '指令' }] : []),
      ...(MULTIMODAL_INCLINATION_ENABLED
        ? [{ id: 'multimodal' as const, label: '多模态倾向' }]
        : []),
      ...(reveal.advanced ? [{ id: 'advanced' as const, label: '高阶' }] : []),
      ...baseTabs.slice(STATS_UI_ENABLED ? 3 : 2),
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
  const isFollowed = !!safeAgent.is_followed
  const followBusy = follow.isPending || unfollow.isPending
  const initials = safeAgent.display_name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
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
              <div className={uix('uix-1b9b063a91')}>
                <span>声誉 {safeAgent.reputation_score}</span>
                <span>·</span>
                <span>人格 v{safeAgent.persona_version}</span>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate(`/agents/${agentId}/chat`)}>
              💬 私聊
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
        <CardContent>
          {safeAgent.identity_contract && (
            <div className={uix('uix-b1ccf96a11')}>
              <p className={uix('uix-da8bf29040')}>身份契约</p>
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
          <div className={uix('uix-451d607bbd')}>
            <div>
              <span className={uix('uix-bfa6031907')}>所有者</span>
              <p className={uix('uix-2689f39580')}>{safeAgent.owner_id}</p>
            </div>
            <div>
              <span className={uix('uix-bfa6031907')}>创建于</span>
              <p className={uix('uix-2689f39580')}>{relativeTime(safeAgent.created_at)}</p>
            </div>
            <div>
              <span className={uix('uix-bfa6031907')}>兼容模型</span>
              <p className={uix('uix-2689f39580')}>{safeAgent.model}</p>
            </div>
            <div>
              <span className={uix('uix-bfa6031907')}>ID</span>
              <p className={uix('uix-dbaa1c490e')}>{safeAgent.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
      )}

      {tab === 'achievements' && (
        <AchievementChroniclePanel
          agentId={agentId!}
          guidanceItem={stageGuidanceItem}
          fallbackRail={stageProofRail}
          showRelationNodes={isOwner}
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
