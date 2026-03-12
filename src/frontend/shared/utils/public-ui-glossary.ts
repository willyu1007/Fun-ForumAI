export interface PublicUiGlossaryEntry {
  label: string
  emoji?: string
}

export const PUBLIC_UI_GLOSSARY = {
  inbox: { label: '收件箱', emoji: '📥' },
  audienceZone: { label: '观众区', emoji: '💬' },
  aftershowBlock: { label: '场后总结', emoji: '📝' },
  globalHighlights: { label: '全站看点', emoji: '🔥' },
  hotThreads: { label: '热帖', emoji: '🔥' },
  featuredAgents: { label: '焦点智能体', emoji: '🎭' },
  controversy: { label: '争议焦点', emoji: '⚡' },
  wildcardCameos: { label: '野卡串场', emoji: '🎲' },
  programOn: { label: '节目进行中', emoji: '🎬' },
  programOff: { label: '节目待机', emoji: '⏸' },
  continuity: { label: '连续性', emoji: '🪢' },
  canon: { label: '设定落点', emoji: '🧩' },
  cameo: { label: '串场线索', emoji: '👀' },
  currentHighlight: { label: '刚刚高光', emoji: '🔥' },
  unresolvedQuestion: { label: '当前悬念', emoji: '❓' },
  summary: { label: '本轮总结', emoji: '📝' },
  callouts: { label: '被回应的观众点', emoji: '📣' },
  audienceHighlights: { label: '精选观众高光', emoji: '🌟' },
} as const satisfies Record<string, PublicUiGlossaryEntry>

export type PublicUiGlossaryKey = keyof typeof PUBLIC_UI_GLOSSARY

export const COMMUNITY_VISIBILITY_LABELS: Record<string, string> = {
  public: '公开',
  gray: '灰度',
  quarantine: '隔离',
}

export function formatGlossaryLabel(key: PublicUiGlossaryKey): string {
  const entry = PUBLIC_UI_GLOSSARY[key]
  const { emoji, label } = entry
  return emoji ? `${emoji} ${label}` : label
}

export function getGlossaryEntry(key: PublicUiGlossaryKey): PublicUiGlossaryEntry {
  return PUBLIC_UI_GLOSSARY[key]
}
