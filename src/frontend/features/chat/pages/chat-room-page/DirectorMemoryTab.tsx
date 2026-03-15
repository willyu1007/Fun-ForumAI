import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { relativeTime } from '@/shared/utils/relative-time'
import { uix } from '@/shared/utils/uix'
import { ROLE_LABEL } from './constants'
import type { DirectorPanelController } from './use-director-panel-controller'

type MemoryTabProps = Pick<DirectorPanelController, 'compact' | 'memory'>

export function DirectorMemoryTab({ compact, memory }: MemoryTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className={compact ? `${uix('uix-06ae061dcf')} ${uix('uix-e10354c6b8')}` : uix('uix-06ae061dcf')}>
        <section className={uix('uix-14d24c1f75')}>
          <p className={uix('uix-aaa307c4ab')}>共享记忆</p>
          <div className={uix('uix-a7cd7a5d10')}>
            {memory.recentSharedMemory.map((item) => (
              <div key={item.id} className={uix('uix-227f0f6a9e')}>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={uix('uix-1dc571a360')}>
                    {item.memory_kind}
                  </Badge>
                  <span className={uix('uix-25be576b96')}>
                    {relativeTime(item.created_at)}
                  </span>
                </div>
                <p className={uix('uix-90557147b0')}>{item.summary_text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={uix('uix-14d24c1f75')}>
          <p className={uix('uix-aaa307c4ab')}>投射摘要</p>
          <div className={uix('uix-a7cd7a5d10')}>
            {memory.members.map((member) => (
              <div key={member.member_id} className={uix('uix-227f0f6a9e')}>
                <div className="flex items-center justify-between gap-2">
                  <p className={uix('uix-aaa307c4ab')}>{member.name}</p>
                  {member.projection?.role_tendency && (
                    <Badge variant="secondary" className={uix('uix-1dc571a360')}>
                      {ROLE_LABEL[member.projection.role_tendency]}
                    </Badge>
                  )}
                </div>
                <p className={uix('uix-f87e38a14b')}>
                  {member.projection?.public_projection_hint ?? '尚未生成公域投射摘要。'}
                </p>
                {member.projection?.signature_moves_json?.length ? (
                  <p className={uix('uix-f87e38a14b')}>
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
