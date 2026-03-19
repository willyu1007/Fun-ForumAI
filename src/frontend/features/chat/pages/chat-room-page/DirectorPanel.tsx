import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OWNER_TABS } from './constants'
import { DirectorControlTab } from './DirectorControlTab'
import { DirectorMemoryTab } from './DirectorMemoryTab'
import { DirectorSignalsTab } from './DirectorSignalsTab'
import { useDirectorPanelController } from './use-director-panel-controller'
import type { RoomControlState } from '@/api/types'

export function DirectorPanel({
  roomId,
  controlState,
  compact = false,
}: {
  roomId: string
  controlState: RoomControlState
  compact?: boolean
}) {
  const controller = useDirectorPanelController({ roomId, controlState, compact })

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" data-ui="section" data-padding="none">
      <Tabs defaultValue={OWNER_TABS[0]} className="flex min-h-0 flex-1 flex-col">
        <div className={"border-b px-4 py-3"}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={"text-xs uppercase tracking-[0.18em] text-muted-foreground"}>房主控制</p>
              <p className={"mt-1 text-sm font-medium"}>
                {controller.controlState.room_status === 'active'
                  ? '房间正在直播'
                  : `状态：${controller.controlState.room_status}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {controller.controlState.alerts.length > 0 && (
                <Badge variant="outline" className={"text-[10px] text-warning"}>
                  {controller.controlState.alerts.length} 条提醒
                </Badge>
              )}
              <Badge
                variant={controller.controlState.program.enabled ? 'default' : 'secondary'}
                className={"text-[10px]"}
              >
                {controller.controlState.program.enabled ? '节目开启' : '节目暂停'}
              </Badge>
            </div>
          </div>
          <TabsList variant="line" className={"mt-3 w-full"}>
            <TabsTrigger value="control">控制</TabsTrigger>
            <TabsTrigger value="signals">信号</TabsTrigger>
            <TabsTrigger value="memory">连续性</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="control" className="min-h-0 flex-1">
          <DirectorControlTab
            compact={controller.compact}
            controlState={controller.controlState}
            programForm={controller.programForm}
            cueForm={controller.cueForm}
            memberControl={controller.memberControl}
          />
        </TabsContent>

        <TabsContent value="signals" className="min-h-0 flex-1">
          <DirectorSignalsTab compact={controller.compact} signals={controller.signals} />
        </TabsContent>

        <TabsContent value="memory" className="min-h-0 flex-1">
          <DirectorMemoryTab compact={controller.compact} memory={controller.memory} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
