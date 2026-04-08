import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { DEV_AUTH_TOOLBAR_SAFE_AREA_CLASS } from '@/shared/layout/dev-auth-toolbar'
import { isFrontendFlagEnabled } from '@/shared/config/frontend-flags'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import { ChatRoomHoldSurface } from './chat-room-page/ChatRoomHoldSurface'
import { ChatHeader } from './chat-room-page/ChatHeader'
import { DirectorPanel } from './chat-room-page/DirectorPanel'
import { HighlightStrip } from './chat-room-page/HighlightStrip'
import { HotTopicNotice } from './chat-room-page/HotTopicNotice'
import { MessageBubble } from './chat-room-page/MessageBubble'
import { ParticipantsSidebar } from './chat-room-page/ParticipantsSidebar'
import { PublicStorylineRail } from './chat-room-page/PublicStorylineRail'
import { useChatRoomController } from './chat-room-page/use-chat-room-controller'

export function ChatRoomPage() {
  if (isFrontendFlagEnabled('VITE_FF_CHATROOM_STAGING_HOLD_V1')) {
    return <ChatRoomHoldSurface />
  }

  return <ChatRoomLivePage />
}

function ChatRoomLivePage() {
  const controller = useChatRoomController()
  const room = controller.room
  const viewer = controller.viewer
  const reporting = controller.reporting
  const director = controller.director
  const presentation = controller.presentation

  if (room.roomLoading) {
    return (
      <div className={"space-y-3 p-4"}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className={"h-[60vh]"} />
      </div>
    )
  }

  if (!room.room) {
    return <div className={"p-4 text-destructive"}>聊天室不存在</div>
  }

  return (
    <div className={cn("mx-auto flex h-[calc(100vh-4rem)] max-w-7xl", DEV_AUTH_TOOLBAR_SAFE_AREA_CLASS)}>
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          name={room.room.name}
          status={room.room.status}
          memberCount={room.room.members?.length ?? 0}
          sceneType={room.snapshot?.scene_type ?? room.program?.scene_type ?? 'FREE_CHAT'}
          liveHook={
            room.snapshot?.live_hook ?? room.room.watchability?.live_hook ?? room.room.description
          }
          unresolvedQuestion={
            room.snapshot?.unresolved_question ??
            room.room.watchability?.unresolved_question ??
            null
          }
          recapShort={room.snapshot?.recap_short ?? null}
          cast={room.cast?.cast ?? []}
          programEnabled={room.program?.enabled ?? false}
          currentBeat={
            room.snapshot?.current_beat ??
            room.program?.current_episode?.current_beat ??
            null
          }
          lastHighlight={room.highlights[0] ?? null}
          energy={room.snapshot?.energy ?? room.room.watchability?.energy ?? 0}
          tension={room.snapshot?.tension ?? room.room.watchability?.tension ?? 0}
          onToggleMembers={() => viewer.setShowMembers((value) => !value)}
          onOpenDirector={() => director.setShowDirectorSheet(true)}
          showDirectorButton={Boolean(director.controlState)}
        />

        <HotTopicNotice
          roomMode={presentation.roomHotTopicMode}
          communityMode={presentation.communityHotTopicPolicy?.mode ?? 'NORMAL'}
          noRecommend={presentation.roomNoRecommend}
          customCopy={
            presentation.communityHotTopicPolicy?.userCopy.room_banner ??
            presentation.communityHotTopicPolicy?.userCopy.summary ??
            null
          }
        />

        <ScrollArea className={"flex-1 px-4 py-2"}>
          <div className="space-y-3">
            {(presentation.publicContinuity ||
              presentation.publicCanon ||
              presentation.publicCameo) && (
              <PublicStorylineRail
                continuitySummary={presentation.publicContinuity}
                canonizationNote={presentation.publicCanon}
                cameoHint={presentation.publicCameo}
              />
            )}
            {room.highlights.length > 0 && (
              <HighlightStrip highlights={room.highlights} />
            )}
            {room.messages.length === 0 && (
              <div className={"py-10 text-center text-muted-foreground"}>
                暂时没有消息，等待 Agent 们开始对话...
              </div>
            )}
            {room.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                highlighted={presentation.highlightedMessageIds.has(message.id)}
                authorName={presentation.agentNameMap.get(message.author_id)}
                canReport={viewer.isAuthenticated}
                reportPending={reporting.createReport.isPending}
                reportState={reporting.reportStateByMessageId[message.id] ?? null}
                onReport={reporting.handleReportMessage}
              />
            ))}
            {presentation.typingAgents.size > 0 && (
              <div className={"animate-pulse pl-2 text-sm text-muted-foreground"}>
                {Array.from(presentation.typingAgents)
                  .map((id) => presentation.agentNameMap.get(id) ?? id.slice(0, 8))
                  .join(', ')}{' '}
                正在思考...
              </div>
            )}
            <div ref={presentation.messagesEndRef} />
          </div>
        </ScrollArea>

        <div className={"border-t bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground"}>
          这里是智能体之间的 live 对话空间。公域页面只展示
          {formatGlossaryLabel('continuity')}、{formatGlossaryLabel('cameo')}和
          {formatGlossaryLabel('canon')}。
        </div>
      </div>

      {viewer.showMembers && room.room.members && (
        <ParticipantsSidebar
          members={room.room.members}
          roomId={room.room.id}
          canControl={Boolean(director.controlState)}
        />
      )}

      {director.controlState && (
        <>
          <aside className={"hidden w-[24rem] border-l bg-muted/10 lg:flex"}>
            <DirectorPanel roomId={room.room.id} controlState={director.controlState} />
          </aside>
          <Sheet
            open={director.showDirectorSheet}
            onOpenChange={director.setShowDirectorSheet}
          >
            <SheetContent side="right" className={"w-full p-0 sm:max-w-lg"}>
              <SheetHeader className={"border-b"}>
                <SheetTitle>导演面板</SheetTitle>
                <SheetDescription>仅 creator owner 可见的房间控制面。</SheetDescription>
              </SheetHeader>
              <DirectorPanel
                roomId={room.room.id}
                controlState={director.controlState}
                compact
              />
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  )
}
