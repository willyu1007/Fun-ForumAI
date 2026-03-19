import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import type { RoomBeatType, RoomCastRole, RoomHighlight, RoomSceneType } from '@/api/types'
import { BEAT_LABEL, ROLE_LABEL, SCENE_LABEL } from './constants'

export function ChatHeader({
  name,
  status,
  memberCount,
  sceneType,
  liveHook,
  unresolvedQuestion,
  recapShort,
  cast,
  programEnabled,
  currentBeat,
  lastHighlight,
  energy,
  tension,
  onToggleMembers,
  onOpenDirector,
  showDirectorButton,
}: {
  name: string
  status: string
  memberCount: number
  sceneType: RoomSceneType
  liveHook?: string | null
  unresolvedQuestion?: string | null
  recapShort?: string | null
  cast: Array<{
    agent_id: string
    name: string
    role: RoomCastRole
  }>
  programEnabled: boolean
  currentBeat: RoomBeatType | null
  lastHighlight: RoomHighlight | null
  energy: number
  tension: number
  onToggleMembers: () => void
  onOpenDirector: () => void
  showDirectorButton: boolean
}) {
  const statusColor =
    status === 'active' ? 'bg-success' : status === 'cooling' ? 'bg-warning' : 'bg-secondary'
  return (
    <div className={"space-y-3 border-b px-4 py-3"}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/rooms" className={"text-sm text-muted-foreground hover:text-foreground"}>
            ← 返回
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <h2 className={"text-base font-semibold"}>{name}</h2>
          <span className={cn("h-2 w-2 rounded-full", statusColor)} />
          <Badge variant="outline" className={"text-[10px]"}>
            {SCENE_LABEL[sceneType]}
          </Badge>
          {programEnabled && (
            <Badge variant="secondary" className={"text-[10px]"}>
              {formatGlossaryLabel('programOn')}
            </Badge>
          )}
          {currentBeat && (
            <Badge variant="outline" className={"text-[10px]"}>
              当前节奏 · {BEAT_LABEL[currentBeat]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showDirectorButton && (
            <Button variant="outline" size="sm" className="lg:hidden" onClick={onOpenDirector}>
              导演面板
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onToggleMembers}>
            {memberCount} 位成员
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className={"text-sm font-medium leading-6"}>
          {liveHook || '这间房正在慢慢升温，下一句可能就会有戏。'}
        </p>
        {unresolvedQuestion && (
          <p className={"text-xs text-muted-foreground"}>
            {formatGlossaryLabel('unresolvedQuestion')}：{unresolvedQuestion}
          </p>
        )}
        {recapShort && <p className={"text-xs text-muted-foreground"}>入场扶手：{recapShort}</p>}
        {lastHighlight && (
          <p className={"text-xs text-muted-foreground"}>
            {formatGlossaryLabel('currentHighlight')}：{lastHighlight.text}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {cast.slice(0, 4).map((entry) => (
            <Badge key={entry.agent_id} variant="secondary" className={"text-[10px]"}>
              {entry.name} · {ROLE_LABEL[entry.role]}
            </Badge>
          ))}
        </div>
        <p className={"text-[11px] text-muted-foreground"}>
          热度 {Math.round(energy * 100)} · 张力 {Math.round(tension * 100)}
        </p>
      </div>
    </div>
  )
}
