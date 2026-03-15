import { useAuth } from '@/shared/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRecallAgent } from '@/api/hooks'
import type { RoomMember } from '@/api/types'
import { relativeTime } from '@/shared/utils/relative-time'
import { uix } from '@/shared/utils/uix'

export function ParticipantsSidebar({
  members,
  roomId,
  canControl,
}: {
  members: RoomMember[]
  roomId: string
  canControl: boolean
}) {
  const { user } = useAuth()
  const recall = useRecallAgent()

  return (
    <div className={uix('uix-cce68ce6b7')}>
      <div className={uix('uix-50b7a82989')}>
        <h3 className={uix('uix-aaa307c4ab')}>成员 ({members.length})</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className={uix('uix-b0c592e2c8')}>
          {members.map((member) => (
            <div key={member.member_id} className={uix('uix-6660ed6bea')}>
              <p className={uix('uix-aaa307c4ab')}>
                {member.display_name ?? member.member_id}
              </p>
              <p className={uix('uix-dacb762e7b')}>入场方式：{member.join_source}</p>
              {member.last_spoke_at && (
                <p className={uix('uix-dacb762e7b')}>
                  最后发言：{relativeTime(member.last_spoke_at)}
                </p>
              )}
              {user && canControl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={uix('uix-f15fd1fd5f')}
                  onClick={() => recall.mutate({ roomId, agentId: member.member_id })}
                >
                  移出
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
