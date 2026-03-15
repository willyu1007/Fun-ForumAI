import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import {
  useCommunities,
  useCreateReport,
  useRoom,
  useRoomCast,
  useRoomControlState,
  useRoomHighlights,
  useRoomLiveSnapshot,
  useRoomMessages,
  useRoomProgram,
} from '@/api/hooks'
import type { ChatMessage } from '@/api/types'
import { useAuth } from '@/shared/hooks/use-auth'
import {
  hasNoRecommendRoomTag,
  readCommunityHotTopicPolicy,
  readRoomHotTopicMode,
} from '@/shared/utils/hot-topic-policy'
import { useChatRoomSse } from '../../hooks/use-chat-room-sse'

export function useChatRoomController() {
  const { roomId } = useParams<{ roomId: string }>()
  const [showMembers, setShowMembers] = useState(false)
  const [showDirectorSheet, setShowDirectorSheet] = useState(false)
  const [reportStateByMessageId, setReportStateByMessageId] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user, isAuthenticated } = useAuth()
  const createReport = useCreateReport()
  const { data: roomData, isLoading: roomLoading } = useRoom(roomId ?? '')
  const { data: msgData } = useRoomMessages(roomId ?? '')
  const { data: communitiesData } = useCommunities()
  const { data: snapshotData } = useRoomLiveSnapshot(roomId ?? '')
  const { data: castData } = useRoomCast(roomId ?? '')
  const { data: programData } = useRoomProgram(roomId ?? '')
  const { data: highlightData } = useRoomHighlights(roomId ?? '', { limit: 6 })
  const controlStateEnabled = Boolean(roomId && user && roomData?.data?.viewer_can_control)
  const { data: controlStateData } = useRoomControlState(roomId ?? '', {
    enabled: controlStateEnabled,
  })

  const room = roomData?.data
  const messages = msgData?.data ?? []
  const snapshot = snapshotData?.data
  const cast = castData?.data
  const program = programData?.data
  const highlights = highlightData?.data ?? []
  const controlState = controlStateData?.data ?? null
  const community = communitiesData?.data?.find((item) => item.id === room?.community_id) ?? null
  const communityHotTopicPolicy = readCommunityHotTopicPolicy(community?.rules_json)
  const roomHotTopicMode = program
    ? readRoomHotTopicMode(program)
    : (room?.watchability?.hot_topic_mode ?? 'NORMAL')
  const roomDiscoverabilityTags =
    program?.discoverability?.tags ?? room?.watchability?.discoverability_tags ?? []
  const roomNoRecommend = hasNoRecommendRoomTag(roomDiscoverabilityTags)
  const { typingAgents } = useChatRoomSse(roomId ?? '')
  const highlightedMessageIds = new Set(highlights.map((item) => item.source_message_id))

  const agentNameMap = new Map<string, string>()
  for (const member of room?.members ?? []) {
    if (member.display_name) {
      agentNameMap.set(member.member_id, member.display_name)
    }
  }
  for (const entry of cast?.cast ?? []) {
    if (!agentNameMap.has(entry.agent_id)) {
      agentNameMap.set(entry.agent_id, entry.name)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleReportMessage = async (message: ChatMessage) => {
    if (!roomId) return
    setReportStateByMessageId((current) => ({
      ...current,
      [message.id]: '',
    }))

    try {
      await createReport.mutateAsync({
        target_type: 'message',
        target_id: message.id,
        complaint_type: 'CONTENT_REPORT',
        reason_code: 'chat_message_report',
        detail_text: `Reported from room ${roomId}: ${message.body.slice(0, 160)}`,
      })
      setReportStateByMessageId((current) => ({
        ...current,
        [message.id]: '聊天室举报已提交，可在 Safety Center 查看进度。',
      }))
    } catch (error) {
      setReportStateByMessageId((current) => ({
        ...current,
        [message.id]:
          error instanceof Error ? error.message : '聊天室举报提交失败，请稍后重试。',
      }))
    }
  }

  return {
    room: {
      roomId,
      roomLoading,
      room,
      messages,
      snapshot,
      cast,
      program,
      highlights,
    },
    viewer: {
      isAuthenticated,
      showMembers,
      setShowMembers,
    },
    reporting: {
      createReport,
      reportStateByMessageId,
      handleReportMessage,
    },
    director: {
      controlState,
      showDirectorSheet,
      setShowDirectorSheet,
    },
    presentation: {
      communityHotTopicPolicy,
      roomHotTopicMode,
      roomNoRecommend,
      typingAgents,
      highlightedMessageIds,
      agentNameMap,
      messagesEndRef,
      publicContinuity:
        snapshot?.continuity_summary ?? room?.watchability?.continuity_summary ?? null,
      publicCanon: snapshot?.canonization_note ?? room?.watchability?.canonization_note ?? null,
      publicCameo: snapshot?.cameo_hint ?? room?.watchability?.cameo_hint ?? null,
    },
  }
}

export type ChatRoomController = ReturnType<typeof useChatRoomController>
