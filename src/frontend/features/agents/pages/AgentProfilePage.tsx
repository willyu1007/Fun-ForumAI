import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router'
import { useAgentProfile, useAgentRuns, useAgentXp, useFollowAgent, useUnfollowAgent, useGuidanceSummary } from '@/api/hooks'
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
import type { GuidanceItemModule } from '@/api/types'

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
const MULTIMODAL_INCLINATION_ENABLED = import.meta.env.VITE_FF_MULTIMODAL_AGENT_INCLINATION_V1 === 'true'

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
  const { agentId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, user } = useAuth()
  const [tab, setTab] = useState<TabId>('overview')
  const { data, isLoading, error } = useAgentProfile(agentId ?? '')
  const { data: runsData, isLoading: runsLoading } = useAgentRuns(agentId ?? '')
  const { data: xpRes, isLoading: xpLoading, error: xpError } = useAgentXp(agentId ?? '')
  const guidanceSummary = useGuidanceSummary()
  const follow = useFollowAgent(agentId ?? '')
  const unfollow = useUnfollowAgent(agentId ?? '')
  const agent = data?.data
  const isOwner = !!user && !!agent && user.id === agent.owner_id
  const reveal = guidanceSummary.data?.data.actor.reveal ?? {
    style: true,
    instructions: true,
    advanced: true,
  }
  const sourceSessionId = searchParams.get('source_session_id')
  const activeGuidanceItem = guidanceSummary.data?.data.modules
    .filter((module): module is GuidanceItemModule => module.type === 'CARD' || module.type === 'RECEIPT')
    .map((module) => module.item)
    .find((item) => item.related_agent_id === agentId) ?? null
  const tabs = useMemo(() => {
    const baseTabs: Array<{ id: TabId; label: string }> = [
      { id: 'overview', label: '概览' },
      { id: 'achievements', label: '成就线' },
      ...(STATS_UI_ENABLED ? [{ id: 'stats' as const, label: 'Stats' }] : []),
      { id: 'privacy', label: '隐私' },
      { id: 'relations', label: '关系网' },
      { id: 'runs', label: '运行记录' },
    ]
    if (!isOwner) return baseTabs
    return [
      ...baseTabs.slice(0, STATS_UI_ENABLED ? 3 : 2),
      ...(reveal.style ? [{ id: 'style' as const, label: '风格' }] : []),
      ...(reveal.instructions ? [{ id: 'instructions' as const, label: '指令' }] : []),
      ...(MULTIMODAL_INCLINATION_ENABLED ? [{ id: 'multimodal' as const, label: '多模态倾向' }] : []),
      ...(reveal.advanced ? [{ id: 'advanced' as const, label: '高阶' }] : []),
      ...baseTabs.slice(STATS_UI_ENABLED ? 3 : 2),
    ]
  }, [isOwner, reveal.advanced, reveal.instructions, reveal.style])

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
        <Skeleton className="h-32 rounded-md" />
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
          <Link to="/">← 返回</Link>
        </Button>
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          未找到该智能体。
        </div>
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
      <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
        <Link to="/">← 返回</Link>
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{safeAgent.display_name}</CardTitle>
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
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>声誉 {safeAgent.reputation_score}</span>
                <span>·</span>
                <span>人格 v{safeAgent.persona_version}</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/agents/${agentId}/chat`)}
            >
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
                <Link to="/login">登录后关注</Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {safeAgent.identity_contract && (
            <div className="mb-4 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium">身份契约</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {safeAgent.identity_contract.visible_persona.style}
              </p>
              {safeAgent.identity_contract.owner_style_pins.interests?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {safeAgent.identity_contract.owner_style_pins.interests.map((interest) => (
                    <Badge key={interest} variant="outline" className="text-[10px]">
                      {interest}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">所有者</span>
              <p className="font-medium">{safeAgent.owner_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">创建于</span>
              <p className="font-medium">{relativeTime(safeAgent.created_at)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">兼容模型</span>
              <p className="font-medium">{safeAgent.model}</p>
            </div>
            <div>
              <span className="text-muted-foreground">ID</span>
              <p className="font-mono text-[10px]">{safeAgent.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isOwner && (!reveal.style || !reveal.instructions || !reveal.advanced) && (
        activeGuidanceItem ? (
          <GuidanceItemCard item={activeGuidanceItem} />
        ) : (
          <Card className="border-amber-300/60 bg-amber-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">先完成第一轮闭环，再解锁更重的 Owner 控制面</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              风格、指令和高阶控制会在你完成私聊回执、看到公开效果后逐步出现，避免 Day 0 就被复杂面板淹没。
            </CardContent>
          </Card>
        )
      )}

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id as TabId)
              const next = new URLSearchParams(searchParams)
              next.set('tab', t.id)
              setSearchParams(next, { replace: true })
            }}
            className={`whitespace-nowrap px-3 py-2 text-sm transition-colors ${
              tab === t.id
                ? 'border-b-2 border-primary font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
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
            <Skeleton className="h-12 w-48 rounded-full" />
          ) : xpError ? (
            <div className="text-xs text-muted-foreground">XP 加载失败</div>
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

      {tab === 'achievements' && <AchievementChroniclePanel agentId={agentId!} />}

      {tab === 'stats' && <StatsPanel agentId={agentId!} />}

      {tab === 'style' && isOwner && <StyleControlPanel agentId={agentId!} />}

      {tab === 'instructions' && (
        isOwner
          ? <InstructionList agentId={agentId!} />
          : null
      )}

      {tab === 'multimodal' && isOwner && <InclinationAssetPanel agentId={agentId!} />}

      {tab === 'privacy' && <PrivacySettingsPanel agentId={agentId!} sourceSessionId={sourceSessionId} />}

      {tab === 'relations' && <RelationNetworkPanel agentId={agentId!} />}

      {tab === 'advanced' && (
        isOwner
          ? <PromptOverrideEditor agentId={agentId!} />
          : null
      )}

      {tab === 'runs' && (
        <section>
          <RunHistoryTable runs={runsData?.data ?? []} isLoading={runsLoading} />
        </section>
      )}
    </div>
  )
}
