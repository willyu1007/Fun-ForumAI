import { useEffect, useState } from 'react'
import {
  useCreateRoomCue,
  usePatchRoomMemberControl,
  usePatchRoomProgram,
} from '@/api/hooks'
import type {
  RoomCastRole,
  RoomControlState,
  RoomCueType,
  RoomSceneType,
} from '@/api/types'
import {
  hasNoRecommendRoomTag,
  readRoomHotTopicMode,
} from '@/shared/utils/hot-topic-policy'

export function useDirectorPanelController({
  roomId,
  controlState,
  compact = false,
}: {
  roomId: string
  controlState: RoomControlState
  compact?: boolean
}) {
  const patchProgram = usePatchRoomProgram(roomId)
  const createCue = useCreateRoomCue(roomId)
  const patchMemberControl = usePatchRoomMemberControl(roomId)
  const [sceneType, setSceneType] = useState<RoomSceneType>(controlState.program.scene_type)
  const [shortHook, setShortHook] = useState(
    controlState.program.discoverability?.short_hook ?? '',
  )
  const [hotTopicMode, setHotTopicMode] = useState<
    'NORMAL' | 'MANUAL_REVIEW_ONLY' | 'DISABLED'
  >(readRoomHotTopicMode(controlState.program as never))
  const [noRecommend, setNoRecommend] = useState(
    hasNoRecommendRoomTag(controlState.program.discoverability?.tags),
  )
  const [cueType, setCueType] = useState<RoomCueType>('ADVANCE')
  const [cueGoal, setCueGoal] = useState('')
  const [targetRole, setTargetRole] = useState<'AUTO' | RoomCastRole>('AUTO')

  useEffect(() => {
    setSceneType(controlState.program.scene_type)
    setShortHook(controlState.program.discoverability?.short_hook ?? '')
    setHotTopicMode(readRoomHotTopicMode(controlState.program as never))
    setNoRecommend(hasNoRecommendRoomTag(controlState.program.discoverability?.tags))
  }, [controlState.program, roomId])

  const discoverabilityTags = noRecommend
    ? Array.from(
        new Set([...(controlState.program.discoverability?.tags ?? []), 'no_recommend']),
      )
    : (controlState.program.discoverability?.tags ?? []).filter(
        (tag) => tag.trim().toLowerCase() !== 'no_recommend',
      )

  return {
    compact,
    controlState,
    programForm: {
      patchProgram,
      sceneType,
      setSceneType,
      shortHook,
      setShortHook,
      hotTopicMode,
      setHotTopicMode,
      noRecommend,
      setNoRecommend,
      discoverabilityTags,
    },
    cueForm: {
      createCue,
      cueType,
      setCueType,
      cueGoal,
      setCueGoal,
      targetRole,
      setTargetRole,
    },
    memberControl: {
      patchMemberControl,
      members: controlState.members,
    },
    signals: {
      alerts: controlState.alerts,
      recentHighlights: controlState.recent_highlights,
      recentProgramEvents: controlState.recent_program_events,
    },
    memory: {
      recentSharedMemory: controlState.recent_shared_memory,
      members: controlState.members,
    },
  }
}

export type DirectorPanelController = ReturnType<typeof useDirectorPanelController>
