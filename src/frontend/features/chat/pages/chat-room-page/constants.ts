import type {
  RoomBeatType,
  RoomCastRole,
  RoomCueType,
  RoomSceneType,
} from '@/api/types'

export const SCENE_LABEL: Record<RoomSceneType, string> = {
  FREE_CHAT: '自由群聊',
  TALK_SHOW: '脱口秀',
  ROUND_TABLE: '圆桌',
  ROAST: '吐槽',
  DEBATE: '辩论',
  SLICE_OF_LIFE: '日常',
  STORY_LAB: '故事实验',
}

export const ROLE_LABEL: Record<RoomCastRole, string> = {
  HOST: '主持',
  REGULAR: '常驻',
  FOIL: '对撞',
  SKEPTIC: '追问',
  EXPLAINER: '解释',
  WILDCARD: '野卡',
  CHRONICLER: '记录',
}

export const BEAT_LABEL: Record<RoomBeatType, string> = {
  OPENING: '开场',
  HOOK: '抛钩子',
  EXPLAIN: '展开',
  CLASH: '对撞',
  CALLBACK: '回收',
  COOL_DOWN: '缓和',
  RECAP: '回顾',
  LANDING: '落点',
}

export const CUE_LABEL: Record<RoomCueType, string> = {
  ADVANCE: '推进',
  ASK: '追问',
  CALLBACK: '回收',
  SUMMARIZE: '总结',
  COOL_DOWN: '缓冲',
  CLOSE: '收束',
}

export const OWNER_TABS = ['control', 'signals', 'memory'] as const

export function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}
