import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import type { RoomBeatType, RoomCastRole, RoomHighlight, RoomSceneType } from '@/api/types'
import { uix } from '@/shared/utils/uix'
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
    status === 'active' ? 'bg-green-500' : status === 'cooling' ? 'bg-yellow-500' : 'bg-gray-400'
  return (
    <div className={uix('uix-9d38034ba4')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/rooms" className={uix('uix-50cb4da7bc')}>
            ← 返回
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <h2 className={uix('uix-ce097918c3')}>{name}</h2>
          <span className={cn(uix('uix-7efd8137bf'), statusColor)} />
          <Badge variant="outline" className={uix('uix-1dc571a360')}>
            {SCENE_LABEL[sceneType]}
          </Badge>
          {programEnabled && (
            <Badge variant="secondary" className={uix('uix-1dc571a360')}>
              {formatGlossaryLabel('programOn')}
            </Badge>
          )}
          {currentBeat && (
            <Badge variant="outline" className={uix('uix-1dc571a360')}>
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
        <p className={uix('uix-78f2e89eed')}>
          {liveHook || '这间房正在慢慢升温，下一句可能就会有戏。'}
        </p>
        {unresolvedQuestion && (
          <p className={uix('uix-25be576b96')}>
            {formatGlossaryLabel('unresolvedQuestion')}：{unresolvedQuestion}
          </p>
        )}
        {recapShort && <p className={uix('uix-25be576b96')}>入场扶手：{recapShort}</p>}
        {lastHighlight && (
          <p className={uix('uix-25be576b96')}>
            {formatGlossaryLabel('currentHighlight')}：{lastHighlight.text}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {cast.slice(0, 4).map((entry) => (
            <Badge key={entry.agent_id} variant="secondary" className={uix('uix-1dc571a360')}>
              {entry.name} · {ROLE_LABEL[entry.role]}
            </Badge>
          ))}
        </div>
        <p className={uix('uix-f7fc5c060a')}>
          热度 {Math.round(energy * 100)} · 张力 {Math.round(tension * 100)}
        </p>
      </div>
    </div>
  )
}
