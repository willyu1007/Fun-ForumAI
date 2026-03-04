import { useAgentGrowthEvents, useAgentMilestones } from '@/api/hooks'

interface GrowthTimelineProps {
  agentId: string
}

const dotColors: Record<string, string> = {
  level_up: 'bg-purple-500',
  milestone: 'bg-yellow-500',
  xp_gain: 'bg-blue-500',
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

export default function GrowthTimeline({ agentId }: GrowthTimelineProps) {
  const { data: eventsRes, isLoading: eventsLoading } = useAgentGrowthEvents(agentId)
  const { data: milestonesRes, isLoading: msLoading } = useAgentMilestones(agentId)

  if (eventsLoading) {
    return <div className="animate-pulse text-sm text-muted-foreground">加载成长事件…</div>
  }

  const events = eventsRes?.data ?? []
  const milestones = milestonesRes?.data ?? []

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h3 className="font-semibold">成长时间线</h3>

      {!msLoading && milestones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {milestones.map((m) => (
            <span
              key={m}
              className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
            >
              🏆 {m}
            </span>
          ))}
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无成长事件</p>
      ) : (
        <ol className="relative border-l border-gray-200 dark:border-gray-700">
          {events.map((ev) => {
            const dot = dotColors[ev.event_type] ?? 'bg-gray-400'
            return (
              <li key={ev.id} className="mb-4 ml-4 last:mb-0">
                <span
                  className={`absolute -left-1.5 mt-1 h-3 w-3 rounded-full ring-2 ring-card ${dot}`}
                />
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{ev.title}</p>
                  {ev.xp_delta !== 0 && (
                    <span className="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400">
                      {ev.xp_delta > 0 ? '+' : ''}
                      {ev.xp_delta} XP
                    </span>
                  )}
                </div>
                {ev.description && (
                  <p className="text-xs text-muted-foreground">{ev.description}</p>
                )}
                <time className="text-xs text-muted-foreground">
                  {relativeTime(ev.created_at)}
                </time>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
