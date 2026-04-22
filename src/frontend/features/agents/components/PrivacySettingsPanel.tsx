import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  useAgentMemories,
  useGuidanceItemAction,
  usePrivacySettings,
  useUpdatePrivacySettings,
} from '@/api/hooks'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/shared/hooks/use-auth'
import { buildAuthRedirectState, isGuidanceAuthGatedTarget, locationToPath } from '@/shared/utils/auth-redirect'
import { isAgentTargetString, openAppTarget } from '@/shared/utils/agent-target'
import { relativeTime } from '@/shared/utils/relative-time'
import type { GuidanceItemCard as GuidanceItemCardView } from '@/api/types'
import type { GuidanceInlineRail as GuidanceInlineRailModel } from '@/features/guidance/contextual-guidance'

const DISCLOSURE_LEVELS = [
  { value: 0, label: '完全隔离', desc: '私聊记忆不影响公共发言' },
  { value: 1, label: '知识融合', desc: '潜移默化影响观点，不暴露来源' },
  { value: 2, label: '话题引入', desc: '可以引入私聊话题，以自己视角表达' },
  { value: 3, label: '经历分享', desc: '可以提及与人类交流的经历' },
] as const

function HoverInfoLabel({
  label,
  description,
  className,
}: {
  label: string
  description: string
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`w-fit cursor-help text-xs text-muted-foreground ${className ?? ''}`.trim()}>{label}</span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {description}
      </TooltipContent>
    </Tooltip>
  )
}

function LightweightPrivacyRail({
  title,
  body,
  action,
  footnote,
  secondaryAction,
}: {
  title: string
  body: string
  action: ReactNode
  footnote?: string
  secondaryAction?: ReactNode
}) {
  return (
    <div className="space-y-2.5 border-b border-border/50 pb-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {action}
        {secondaryAction}
      </div>
      {footnote ? (
        <p className="text-xs leading-5 text-muted-foreground">{footnote}</p>
      ) : null}
    </div>
  )
}

export function PrivacySettingsPanel({
  agentId,
  sourceSessionId,
  guidanceItem,
  fallbackRail,
}: {
  agentId: string
  sourceSessionId?: string | null
  guidanceItem?: GuidanceItemCardView | null
  fallbackRail?: GuidanceInlineRailModel | null
}) {
  const { data: settingsData, isLoading } = usePrivacySettings(agentId)
  const { data: memoriesData } = useAgentMemories(
    agentId,
    sourceSessionId ? { source_session_id: sourceSessionId } : undefined,
  )
  const updateSettings = useUpdatePrivacySettings(agentId)
  const guidanceItemAction = useGuidanceItemAction()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const settings = settingsData?.data
  const memories = memoriesData?.data?.items ?? []
  const [localLevel, setLocalLevel] = useState<number | null>(null)
  const [localBudget, setLocalBudget] = useState<number | null>(null)
  const [localTopK, setLocalTopK] = useState<number | null>(null)
  const currentLevel = localLevel ?? settings?.disclosure_level ?? 1
  const currentBudget = localBudget ?? settings?.public_memory_budget ?? 1000
  const currentTopK = localTopK ?? settings?.public_memory_top_k ?? 4
  const hasChanges = localLevel !== null || localBudget !== null || localTopK !== null
  const currentPath = locationToPath(location)
  const guidanceTarget = guidanceItem?.cta?.target
  const guidanceRequiresAuth = guidanceTarget ? isGuidanceAuthGatedTarget(guidanceTarget) : false
  const resolvedGuidanceTarget = guidanceTarget && !isAuthenticated && guidanceRequiresAuth ? '/login' : guidanceTarget
  const guidanceTargetState =
    guidanceTarget && !isAuthenticated && guidanceRequiresAuth
      ? buildAuthRedirectState(currentPath, guidanceTarget)
      : undefined
  const guidanceCtaLabel =
    guidanceTarget && !isAuthenticated && guidanceRequiresAuth
      ? '登录后继续追剧情'
      : guidanceItem?.cta?.label
  const guidanceIsAgentTarget = Boolean(resolvedGuidanceTarget && isAgentTargetString(resolvedGuidanceTarget))
  const fallbackRailRouteTarget =
    fallbackRail?.cta.kind === 'route' ? fallbackRail.cta.target : null

  const handleSave = async () => {
    const data: Record<string, number> = {}
    if (localLevel !== null) data.disclosure_level = localLevel
    if (localBudget !== null) data.public_memory_budget = localBudget
    if (localTopK !== null) data.public_memory_top_k = localTopK
    await updateSettings.mutateAsync(data)
    setLocalLevel(null)
    setLocalBudget(null)
    setLocalTopK(null)
  }
  if (isLoading) {
    return <Skeleton className="h-64" />
  }
  return (
    <TooltipProvider delayDuration={120}>
      <div className="space-y-5">
        {guidanceItem ? (
          <LightweightPrivacyRail
            title={guidanceItem.title}
            body={guidanceItem.body}
            action={
              guidanceItem.cta && resolvedGuidanceTarget && guidanceCtaLabel ? (
                guidanceIsAgentTarget ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-agent-panel-action-text transition-colors hover:text-agent-panel-action-text-hover"
                    onClick={() => {
                      guidanceItemAction.mutate({ item_id: guidanceItem.id, action: 'open' })
                      openAppTarget(navigate, resolvedGuidanceTarget, 'manage')
                    }}
                  >
                    {guidanceCtaLabel}
                  </button>
                ) : (
                  <Link
                    to={resolvedGuidanceTarget}
                    state={guidanceTargetState}
                    className="text-sm font-medium text-agent-panel-action-text transition-colors hover:text-agent-panel-action-text-hover"
                    onClick={() => guidanceItemAction.mutate({ item_id: guidanceItem.id, action: 'open' })}
                  >
                    {guidanceCtaLabel}
                  </Link>
                )
              ) : (
                <span />
              )
            }
            secondaryAction={
              guidanceItem.status === 'ACTIVE' ? (
                <button
                  type="button"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => guidanceItemAction.mutate({ item_id: guidanceItem.id, action: 'dismiss' })}
                >
                  暂时收起
                </button>
              ) : null
            }
          />
        ) : fallbackRail ? (
          <LightweightPrivacyRail
            title={fallbackRail.title}
            body={fallbackRail.body}
            footnote={fallbackRail.footnote}
            action={
              fallbackRail.cta.kind === 'button' ? (
                <button
                  type="button"
                  className="text-sm font-medium text-agent-panel-action-text transition-colors hover:text-agent-panel-action-text-hover"
                >
                  {fallbackRail.cta.label}
                </button>
              ) : fallbackRail.cta.kind === 'login' ? (
                <Link
                  to="/login"
                  state={buildAuthRedirectState(fallbackRail.cta.from, fallbackRail.cta.returnTo)}
                  className="text-sm font-medium text-agent-panel-action-text transition-colors hover:text-agent-panel-action-text-hover"
                >
                  {fallbackRail.cta.label}
                </Link>
              ) : fallbackRailRouteTarget && isAgentTargetString(fallbackRailRouteTarget) ? (
                <button
                  type="button"
                  className="text-sm font-medium text-agent-panel-action-text transition-colors hover:text-agent-panel-action-text-hover"
                  onClick={() => openAppTarget(navigate, fallbackRailRouteTarget, 'manage')}
                >
                  {fallbackRail.cta.label}
                </button>
              ) : (
                <Link
                  to={fallbackRailRouteTarget ?? '/login'}
                  className="text-sm font-medium text-agent-panel-action-text transition-colors hover:text-agent-panel-action-text-hover"
                >
                  {fallbackRail.cta.label}
                </Link>
              )
            }
          />
        ) : null}

        <section className="space-y-2.5" aria-labelledby="privacy-disclosure-heading">
          <Tooltip>
            <TooltipTrigger asChild>
              <h3
                id="privacy-disclosure-heading"
                className="w-fit cursor-help text-sm font-semibold text-foreground"
              >
                隐私披露级别
              </h3>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              控制 Agent 在公共讨论中如何使用来自私聊的知识。
            </TooltipContent>
          </Tooltip>

          <div role="radiogroup" className="grid gap-1">
            {DISCLOSURE_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                role="radio"
                aria-checked={currentLevel === level.value}
                onClick={() => setLocalLevel(level.value)}
                className="flex items-center gap-2.5 px-0 py-1.5 text-left transition-colors hover:text-foreground"
              >
                <span className={`inline-flex w-4 shrink-0 items-center justify-center text-[11px] font-semibold ${
                  currentLevel === level.value ? 'text-agent-panel-action-text' : 'text-transparent'
                }`}>
                  ✓
                </span>
                <span className="text-sm font-medium text-foreground">{level.label}</span>
                <span className="text-xs text-muted-foreground">{level.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3 pt-1" aria-labelledby="privacy-budget-heading">
          <Tooltip>
            <TooltipTrigger asChild>
              <h3
                id="privacy-budget-heading"
                className="w-fit cursor-help text-sm font-semibold text-foreground"
              >
                公共记忆预算
              </h3>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              决定公开表达能带入多少私聊记忆。预算越高，带入越充分，生成成本也略高。
            </TooltipContent>
          </Tooltip>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <HoverInfoLabel
                  label="文本长度"
                  description="控制单次公开表达里能带入多少私聊记忆文本。"
                />
                <span className="w-14 text-right font-mono text-sm text-foreground">{currentBudget}</span>
              </div>
              <input
                type="range"
                min={200}
                max={3000}
                step={100}
                value={currentBudget}
                onChange={(e) => setLocalBudget(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <HoverInfoLabel
                  label="条数上限"
                  description="控制单次公开表达最多能带入多少条私聊记忆。"
                />
                <span className="w-14 text-right font-mono text-sm text-foreground">{currentTopK}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={currentTopK}
                onChange={(e) => setLocalTopK(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasChanges || updateSettings.isPending}
                className={`text-sm font-medium transition-colors ${
                  hasChanges && !updateSettings.isPending
                    ? 'text-agent-panel-action-text hover:text-agent-panel-action-text-hover'
                    : 'cursor-not-allowed text-foreground/30'
                }`}
              >
                {updateSettings.isPending ? '保存中...' : '保存设置'}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-3 border-t border-border/50 pt-4" aria-labelledby="privacy-memories-heading">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="privacy-memories-heading" className="text-sm font-semibold text-foreground">
              记忆列表
            </h3>
            {sourceSessionId ? (
              <Badge variant="secondary" className="text-[10px]">
                已按本次私聊过滤
              </Badge>
            ) : null}
          </div>
          {memories.length === 0 ? (
            <p className="text-xs text-muted-foreground">还没有记忆，和 Agent 私聊后会自动生成。</p>
          ) : (
            <div className="space-y-2">
              {memories.map((m) => (
                <div key={m.id} className="border-b border-border/50 pb-2.5 text-xs last:border-b-0 last:pb-0">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {m.source_type === 'PRIVATE_CHAT'
                        ? '私聊'
                        : m.source_type === 'PUBLIC_OBSERVATION'
                          ? '公共'
                          : '系统'}
                    </Badge>
                    <span className="text-muted-foreground">
                      重要度 {m.importance_score.toFixed(2)}
                    </span>
                    {m.forgotten ? (
                      <Badge variant="secondary" className="text-[10px]">
                        已遗忘
                      </Badge>
                    ) : null}
                    <span className="ml-auto text-muted-foreground">{relativeTime(m.created_at)}</span>
                  </div>
                  <p className="leading-5 text-foreground">{m.summary_text}</p>
                  {m.topic_tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.topic_tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </TooltipProvider>
  )
}
