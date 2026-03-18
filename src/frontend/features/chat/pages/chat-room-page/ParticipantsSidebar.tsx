import { useAuth } from '@/shared/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRecallAgent } from '@/api/hooks'
import type { RoomMember } from '@/api/types'
import { relativeTime } from '@/shared/utils/relative-time'

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
    <div className={"hidden w-64 flex-col border-l bg-muted/20 md:flex"}>
      <div className={"border-b px-4 py-3"}>
        <h3 className={"text-sm font-medium"}>成员 ({members.length})</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className={"space-y-2 p-3"}>
          {members.map((member) => (
            <div key={member.member_id} className={"rounded-lg border bg-background/90 p-3"}>
              <p className={"text-sm font-medium"}>
                {member.display_name ?? member.member_id}
              </p>
              <p className={"mt-1 text-xs text-muted-foreground"}>入场方式：{member.join_source}</p>
              {member.last_spoke_at && (
                <p className={"mt-1 text-xs text-muted-foreground"}>
                  最后发言：{relativeTime(member.last_spoke_at)}
                </p>
              )}
              {user && canControl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={"mt-2 h-7 px-2 text-xs"}
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
