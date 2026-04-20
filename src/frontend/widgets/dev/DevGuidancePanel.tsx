import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, X } from 'lucide-react'
import { useGuidanceSummary, useMyAgents } from '@/api/hooks'
import { useDevGuidanceScenarioMutation } from '@/api/hooks/dev'
import type { DevGuidanceScenarioId, GuidanceActorState } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { clearGuidanceRailSnoozeRecords } from '@/features/guidance/rail/snooze'
import { useAuth } from '@/shared/hooks/use-auth'
import { useDevGuidanceStore } from '@/shared/stores/dev-guidance-store'

interface DevGuidancePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const HOME_RECENT_ACTIVITY_CLEARED_AT_KEY = 'home-recent-activity-cleared-at'

const SCENARIOS: Array<{
  id: DevGuidanceScenarioId
  label: string
  summary: string
  localAgentMode?: 'LIVE' | 'EMPTY'
}> = [
  {
    id: 'NO_AGENT_BOOTSTRAP',
    label: '无 Agent 引导',
    summary: '还没有 Agent 时的首页 takeover。',
    localAgentMode: 'EMPTY',
  },
  {
    id: 'FIRST_PRIVATE_CHAT_BLOCKER',
    label: '首次私聊引导',
    summary: '有 Agent，但还没开始私聊。',
    localAgentMode: 'LIVE',
  },
  {
    id: 'UNREAD_RECEIPT_READY',
    label: '未读回执',
    summary: '有新回执等待查看。',
    localAgentMode: 'LIVE',
  },
  {
    id: 'PUBLIC_EFFECT_READY',
    label: '公开效果就绪',
    summary: '私聊影响已体现在公开内容中。',
    localAgentMode: 'LIVE',
  },
]

const COMPLETED_FLAG_LABELS: Array<{
  key: keyof GuidanceActorState['completed']
  label: string
}> = [
  { key: 'followed_first_agent', label: '关注首个角色' },
  { key: 'used_following_feed', label: '使用关注列表' },
  { key: 'created_agent', label: '创建角色' },
  { key: 'started_private_chat', label: '发起私聊' },
  { key: 'nurture_receipt_ready', label: '回执就绪' },
  { key: 'watch_public_effect', label: '查看公开效果' },
]

function readMutationErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return '场景切换失败'
  return error.message
}

export function DevGuidancePanel({ open, onOpenChange }: DevGuidancePanelProps) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const summaryQuery = useGuidanceSummary()
  const myAgentsQuery = useMyAgents(isAuthenticated)
  const scenarioMutation = useDevGuidanceScenarioMutation()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const setMyAgentsMode = useDevGuidanceStore((state) => state.setMyAgentsMode)

  const actor = summaryQuery.data?.data?.actor ?? null
  const actorId = actor?.actor_id ?? null

  const handleApplyScenario = async (scenario: DevGuidanceScenarioId) => {
    const config = SCENARIOS.find((item) => item.id === scenario)
    clearGuidanceRailSnoozeRecords(actorId)
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(HOME_RECENT_ACTIVITY_CLEARED_AT_KEY)
    }
    if (config?.localAgentMode) {
      setMyAgentsMode(config.localAgentMode)
    }
    try {
      await scenarioMutation.mutateAsync({ scenario })
      void myAgentsQuery.refetch()
      void navigate('/feed')
      setStatusMessage(`已应用「${config?.label ?? scenario}」`)
    } catch (error) {
      setStatusMessage(readMutationErrorMessage(error))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="left"
        showCloseButton={false}
        aria-describedby={undefined}
        className="w-full p-0 sm:max-w-sm"
      >
        <SheetHeader className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-sm">引导调试面板</SheetTitle>
            <SheetDescription className="sr-only">Guidance 系统调试工具</SheetDescription>
            <Badge variant="outline" className="text-[10px]">dev-only</Badge>
          </div>
        </SheetHeader>

        <div className="divide-y divide-border/50">

          {/* ── 完成度 ── */}
          <section className="px-4 py-4" data-testid="dev-guidance-actor">
            <p className="mb-3 text-xs font-semibold text-foreground">完成度</p>

            {!actor ? (
              <p className="text-[11px] text-muted-foreground">
                {summaryQuery.isLoading ? '加载中…' : '无数据（可能未登录或 Guidance 未开启）'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {COMPLETED_FLAG_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className={cn(
                        'inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border',
                        actor.completed[key]
                          ? 'border-success/50 bg-success/10 text-success'
                          : 'border-border bg-muted/30 text-transparent',
                      )}
                    >
                      {actor.completed[key] && <Check className="size-2.5" />}
                    </span>
                    <span className={actor.completed[key] ? 'text-foreground' : 'text-muted-foreground'}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── 场景切换 ── */}
          <section className="px-4 py-4" data-testid="dev-guidance-scenarios">
            <p className="mb-3 text-xs font-semibold text-foreground">场景切换</p>

            {statusMessage && (
              <div className="mb-3 flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                <span className="min-w-0 flex-1">{statusMessage}</span>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground/60 hover:text-foreground"
                  onClick={() => setStatusMessage(null)}
                  aria-label="关闭提示"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  disabled={!isAuthenticated || scenarioMutation.isPending}
                  className={cn(
                    'rounded-md border px-3 py-2.5 text-left transition-colors',
                    'hover:border-primary/30 hover:bg-primary/[0.04]',
                    'disabled:pointer-events-none disabled:opacity-50',
                  )}
                  onClick={() => { void handleApplyScenario(scenario.id) }}
                >
                  <p className="text-[11px] font-medium text-foreground">{scenario.label}</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{scenario.summary}</p>
                </button>
              ))}
            </div>

            {!isAuthenticated && (
              <p className="mt-3 text-[11px] text-muted-foreground">先切到用户身份，再应用场景。</p>
            )}
          </section>

        </div>
      </SheetContent>
    </Sheet>
  )
}
