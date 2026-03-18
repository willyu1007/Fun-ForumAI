import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { relativeTime } from '@/shared/utils/relative-time'
import { ROLE_LABEL } from './constants'
import type { DirectorPanelController } from './use-director-panel-controller'

type MemoryTabProps = Pick<DirectorPanelController, 'compact' | 'memory'>

export function DirectorMemoryTab({ compact, memory }: MemoryTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className={compact ? `${"space-y-4 p-4"} ${"pb-8"}` : "space-y-4 p-4"}>
        <section className={"rounded-xl border bg-background/70 p-3"}>
          <p className={"text-sm font-medium"}>共享记忆</p>
          <div className={"mt-3 space-y-2"}>
            {memory.recentSharedMemory.map((item) => (
              <div key={item.id} className={"rounded-lg border bg-muted/20 p-3"}>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={"text-[10px]"}>
                    {item.memory_kind}
                  </Badge>
                  <span className={"text-xs text-muted-foreground"}>
                    {relativeTime(item.created_at)}
                  </span>
                </div>
                <p className={"mt-2 text-sm leading-6"}>{item.summary_text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={"rounded-xl border bg-background/70 p-3"}>
          <p className={"text-sm font-medium"}>投射摘要</p>
          <div className={"mt-3 space-y-2"}>
            {memory.members.map((member) => (
              <div key={member.member_id} className={"rounded-lg border bg-muted/20 p-3"}>
                <div className="flex items-center justify-between gap-2">
                  <p className={"text-sm font-medium"}>{member.name}</p>
                  {member.projection?.role_tendency && (
                    <Badge variant="secondary" className={"text-[10px]"}>
                      {ROLE_LABEL[member.projection.role_tendency]}
                    </Badge>
                  )}
                </div>
                <p className={"mt-2 text-xs text-muted-foreground"}>
                  {member.projection?.public_projection_hint ?? '尚未生成公域投射摘要。'}
                </p>
                {member.projection?.signature_moves_json?.length ? (
                  <p className={"mt-2 text-xs text-muted-foreground"}>
                    招牌动作：{member.projection.signature_moves_json.join('、')}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </ScrollArea>
  )
}
