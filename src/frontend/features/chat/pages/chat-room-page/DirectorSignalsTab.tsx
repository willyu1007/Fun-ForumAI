import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { relativeTime } from '@/shared/utils/relative-time'
import { CUE_LABEL } from './constants'
import type { DirectorPanelController } from './use-director-panel-controller'

type SignalsTabProps = Pick<DirectorPanelController, 'compact' | 'signals'>

export function DirectorSignalsTab({ compact, signals }: SignalsTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className={compact ? `${"space-y-4 p-4"} ${"pb-8"}` : "space-y-4 p-4"}>
        <section className={"rounded-xl border bg-background/70 p-3"}>
          <p className={"text-sm font-medium"}>提醒</p>
          <div className={"mt-2 flex flex-wrap gap-2"}>
            {signals.alerts.length > 0 ? (
              signals.alerts.map((alert) => (
                <Badge key={alert} variant="outline" className={"text-[10px]"}>
                  {alert}
                </Badge>
              ))
            ) : (
              <p className={"text-xs text-muted-foreground"}>当前没有提醒。</p>
            )}
          </div>
        </section>

        <section className={"rounded-xl border bg-background/70 p-3"}>
          <p className={"text-sm font-medium"}>最近高光</p>
          <div className={"mt-3 space-y-2"}>
            {signals.recentHighlights.map((highlight) => (
              <div key={highlight.id} className={"rounded-lg border bg-muted/20 p-3"}>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className={"text-[10px]"}>
                    {highlight.kind}
                  </Badge>
                  <span className={"text-xs text-muted-foreground"}>
                    {relativeTime(highlight.created_at)}
                  </span>
                </div>
                <p className={"mt-2 text-sm leading-6"}>{highlight.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={"rounded-xl border bg-background/70 p-3"}>
          <p className={"text-sm font-medium"}>节目事件</p>
          <div className={"mt-3 space-y-2"}>
            {signals.recentProgramEvents.map((event) => (
              <div key={event.id} className={"rounded-lg border bg-muted/20 p-3"}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={"text-[10px]"}>
                      {event.status}
                    </Badge>
                    {event.cue_type && (
                      <Badge variant="secondary" className={"text-[10px]"}>
                        {CUE_LABEL[event.cue_type]}
                      </Badge>
                    )}
                  </div>
                  <span className={"text-xs text-muted-foreground"}>
                    {relativeTime(event.created_at)}
                  </span>
                </div>
                {event.director_goal && (
                  <p className={"mt-2 text-sm leading-6"}>{event.director_goal}</p>
                )}
                {event.selection_reasons.length > 0 && (
                  <div className={"mt-2 space-y-2"}>
                    {event.selection_reasons.slice(0, 3).map((reason) => (
                      <div key={reason.id} className={"rounded-md bg-background/80 px-2 py-2 text-xs text-muted-foreground"}>
                        {reason.candidate_agent_id} · {reason.selected ? '已选中' : '候选'} ·{' '}
                        {reason.final_score.toFixed(2)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </ScrollArea>
  )
}
