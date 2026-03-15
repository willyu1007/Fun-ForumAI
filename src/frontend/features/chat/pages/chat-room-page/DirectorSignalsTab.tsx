import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { relativeTime } from '@/shared/utils/relative-time'
import { uix } from '@/shared/utils/uix'
import { CUE_LABEL } from './constants'
import type { DirectorPanelController } from './use-director-panel-controller'

type SignalsTabProps = Pick<DirectorPanelController, 'compact' | 'signals'>

export function DirectorSignalsTab({ compact, signals }: SignalsTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className={compact ? `${uix('uix-06ae061dcf')} ${uix('uix-e10354c6b8')}` : uix('uix-06ae061dcf')}>
        <section className={uix('uix-14d24c1f75')}>
          <p className={uix('uix-aaa307c4ab')}>提醒</p>
          <div className={uix('uix-2017a99066')}>
            {signals.alerts.length > 0 ? (
              signals.alerts.map((alert) => (
                <Badge key={alert} variant="outline" className={uix('uix-1dc571a360')}>
                  {alert}
                </Badge>
              ))
            ) : (
              <p className={uix('uix-25be576b96')}>当前没有提醒。</p>
            )}
          </div>
        </section>

        <section className={uix('uix-14d24c1f75')}>
          <p className={uix('uix-aaa307c4ab')}>最近高光</p>
          <div className={uix('uix-a7cd7a5d10')}>
            {signals.recentHighlights.map((highlight) => (
              <div key={highlight.id} className={uix('uix-227f0f6a9e')}>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className={uix('uix-1dc571a360')}>
                    {highlight.kind}
                  </Badge>
                  <span className={uix('uix-25be576b96')}>
                    {relativeTime(highlight.created_at)}
                  </span>
                </div>
                <p className={uix('uix-90557147b0')}>{highlight.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={uix('uix-14d24c1f75')}>
          <p className={uix('uix-aaa307c4ab')}>节目事件</p>
          <div className={uix('uix-a7cd7a5d10')}>
            {signals.recentProgramEvents.map((event) => (
              <div key={event.id} className={uix('uix-227f0f6a9e')}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={uix('uix-1dc571a360')}>
                      {event.status}
                    </Badge>
                    {event.cue_type && (
                      <Badge variant="secondary" className={uix('uix-1dc571a360')}>
                        {CUE_LABEL[event.cue_type]}
                      </Badge>
                    )}
                  </div>
                  <span className={uix('uix-25be576b96')}>
                    {relativeTime(event.created_at)}
                  </span>
                </div>
                {event.director_goal && (
                  <p className={uix('uix-90557147b0')}>{event.director_goal}</p>
                )}
                {event.selection_reasons.length > 0 && (
                  <div className={uix('uix-813892bc68')}>
                    {event.selection_reasons.slice(0, 3).map((reason) => (
                      <div key={reason.id} className={uix('uix-be6b041d71')}>
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
