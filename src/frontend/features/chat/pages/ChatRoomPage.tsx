import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { DEV_AUTH_TOOLBAR_SAFE_AREA_CLASS } from '@/shared/layout/dev-auth-toolbar'
import { formatGlossaryLabel } from '@/shared/utils/public-ui-glossary'
import { uix } from '@/shared/utils/uix'
import { ChatHeader } from './chat-room-page/ChatHeader'
import { DirectorPanel } from './chat-room-page/DirectorPanel'
import { HighlightStrip } from './chat-room-page/HighlightStrip'
import { HotTopicNotice } from './chat-room-page/HotTopicNotice'
import { MessageBubble } from './chat-room-page/MessageBubble'
import { ParticipantsSidebar } from './chat-room-page/ParticipantsSidebar'
import { PublicStorylineRail } from './chat-room-page/PublicStorylineRail'
import { useChatRoomController } from './chat-room-page/use-chat-room-controller'

export function ChatRoomPage() {
  const controller = useChatRoomController()

  if (controller.roomLoading) {
    return (
      <div className={uix('uix-edaf7e98d8')}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className={uix('uix-f0e0e07ba9')} />
      </div>
    )
  }

  if (!controller.room) {
    return <div className={uix('uix-3973a73bc4')}>聊天室不存在</div>
  }

  return (
    <div className={cn(uix('uix-6489629c6b'), DEV_AUTH_TOOLBAR_SAFE_AREA_CLASS)}>
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          name={controller.room.name}
          status={controller.room.status}
          memberCount={controller.room.members?.length ?? 0}
          sceneType={controller.snapshot?.scene_type ?? controller.program?.scene_type ?? 'FREE_CHAT'}
          liveHook={
            controller.snapshot?.live_hook ??
            controller.room.watchability?.live_hook ??
            controller.room.description
          }
          unresolvedQuestion={
            controller.snapshot?.unresolved_question ??
            controller.room.watchability?.unresolved_question ??
            null
          }
          recapShort={controller.snapshot?.recap_short ?? null}
          cast={controller.cast?.cast ?? []}
          programEnabled={controller.program?.enabled ?? false}
          currentBeat={
            controller.snapshot?.current_beat ??
            controller.program?.current_episode?.current_beat ??
            null
          }
          lastHighlight={controller.highlights[0] ?? null}
          energy={controller.snapshot?.energy ?? controller.room.watchability?.energy ?? 0}
          tension={controller.snapshot?.tension ?? controller.room.watchability?.tension ?? 0}
          onToggleMembers={() => controller.setShowMembers((value) => !value)}
          onOpenDirector={() => controller.setShowDirectorSheet(true)}
          showDirectorButton={Boolean(controller.controlState)}
        />

        <HotTopicNotice
          roomMode={controller.roomHotTopicMode}
          communityMode={controller.communityHotTopicPolicy?.mode ?? 'NORMAL'}
          noRecommend={controller.roomNoRecommend}
          customCopy={
            controller.communityHotTopicPolicy?.userCopy.room_banner ??
            controller.communityHotTopicPolicy?.userCopy.summary ??
            null
          }
        />

        <ScrollArea className={uix('uix-83d918e44e')}>
          <div className="space-y-3">
            {(controller.publicContinuity || controller.publicCanon || controller.publicCameo) && (
              <PublicStorylineRail
                continuitySummary={controller.publicContinuity}
                canonizationNote={controller.publicCanon}
                cameoHint={controller.publicCameo}
              />
            )}
            {controller.highlights.length > 0 && (
              <HighlightStrip highlights={controller.highlights} />
            )}
            {controller.messages.length === 0 && (
              <div className={uix('uix-634db381a1')}>
                暂时没有消息，等待 Agent 们开始对话...
              </div>
            )}
            {controller.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                highlighted={controller.highlightedMessageIds.has(message.id)}
                authorName={controller.agentNameMap.get(message.author_id)}
                canReport={controller.isAuthenticated}
                reportPending={controller.createReport.isPending}
                reportState={controller.reportStateByMessageId[message.id] ?? null}
                onReport={controller.handleReportMessage}
              />
            ))}
            {controller.typingAgents.size > 0 && (
              <div className={uix('uix-29a3467e30')}>
                {Array.from(controller.typingAgents)
                  .map((id) => controller.agentNameMap.get(id) ?? id.slice(0, 8))
                  .join(', ')}{' '}
                正在思考...
              </div>
            )}
            <div ref={controller.messagesEndRef} />
          </div>
        </ScrollArea>

        <div className={uix('uix-d148b4faaa')}>
          这里是智能体之间的 live 对话空间。公域页面只展示
          {formatGlossaryLabel('continuity')}、{formatGlossaryLabel('cameo')}和
          {formatGlossaryLabel('canon')}。
        </div>
      </div>

      {controller.showMembers && controller.room.members && (
        <ParticipantsSidebar
          members={controller.room.members}
          roomId={controller.room.id}
          canControl={Boolean(controller.controlState)}
        />
      )}

      {controller.controlState && (
        <>
          <aside className={uix('uix-0ee0f941cf')}>
            <DirectorPanel roomId={controller.room.id} controlState={controller.controlState} />
          </aside>
          <Sheet
            open={controller.showDirectorSheet}
            onOpenChange={controller.setShowDirectorSheet}
          >
            <SheetContent side="right" className={uix('uix-bfe1b1b1b7')}>
              <SheetHeader className={uix('uix-65fdbade20')}>
                <SheetTitle>导演面板</SheetTitle>
                <SheetDescription>仅 creator owner 可见的房间控制面。</SheetDescription>
              </SheetHeader>
              <DirectorPanel
                roomId={controller.room.id}
                controlState={controller.controlState}
                compact
              />
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  )
}
