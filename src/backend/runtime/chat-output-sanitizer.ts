const CHAT_PREFIX_RE = /^\[CHAT\]\s*[:：]?\s*/i
const CHAT_SUFFIX_RE = /\s*\[END_OF_CHAT\]\s*$/i
const WRAPPING_QUOTES_RE = /^["'“”‘’`]+|["'“”‘’`]+$/g
const LEADING_STAGE_DIRECTION_RE = /^(?:(?:（[^）\n]{1,24}）|\([^)\n]{1,24}\))\s*)+/u
const LEADING_ALERT_MARKER_RE = /^\[(?:!|！)\]\s*/u
const LEADING_BRACKET_ACTION_RE =
  /^\[(?:笑|停顿|沉默|思考|思索|挑眉|皱眉|点头|摇头|叹气|耸肩|看向[^\]\n]{0,8}|望向[^\]\n]{0,8}|转向[^\]\n]{0,8})\]\s*/u
const LEADING_SPEAKER_LABEL_RE =
  /^(?:\[[^\]\n]{1,24}\]|【[^】\n]{1,24}】|[A-Za-z0-9_\-\u4E00-\u9FFF]{2,24})\s*[:：]\s*/u
const INLINE_STAGE_DIRECTION_RE =
  /[（(](?:[^）)\n]{0,12}(?:轻抚|前倾|后仰|神情|目光|表情|身体|手指|双手|双眸|手|桌面|桌上|椅背|屏幕|眼神|视线|敲击|摊手|挑眉|耸肩|点头|摇头|皱眉|停顿|低声|沉吟|沉思|苦笑|微笑|叹气|追问|补充|插话|看向|看着|望向|望着|转向|注视|凝视|紧盯)[^）)\n]{0,24}|追问|补充|插话|停顿)[）)]/gu
const FORUM_QUOTE_LINE_PATTERNS = [
  /^\[展开\]/,
  /^>+/,
  /回复于/,
  /^楼\d+/,
]

const META_PATTERNS = [
  /热身阶段/,
  /建议(?:主持人|现场|各方|观众|大家)/,
  /引导(?:各方|观众|大家)/,
  /观众的兴趣/,
  /各方暂未投入/,
  /可适时抛出/,
  /当前(?:局面|看点|悬念|目标)[:：]/,
  /房间现场/,
]

const CUSTOMER_SERVICE_SIGNAL_RE =
  /对于您提到的|我可以为您|为您整理|为您提供|您可以从|如有具体疑问|特定的环境或需求/u
const ENUMERATION_MARKER_RE = /首先|其次|另外|最后|一是|二是|三是|四是/gu

export interface SanitizedChatOutput {
  text: string
  looks_meta: boolean
}

function stripForumQuoteScaffolding(text: string): string {
  const keptLines: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (keptLines.length > 0 && keptLines[keptLines.length - 1] !== '') {
        keptLines.push('')
      }
      continue
    }

    if (FORUM_QUOTE_LINE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      continue
    }

    keptLines.push(trimmed)
  }

  return keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function compactExpositoryReply(text: string): string {
  let working = text
  let shouldCompact = CUSTOMER_SERVICE_SIGNAL_RE.test(working)

  working = working.replace(
    /^对于您提到的[“"「]?([^”"」]+)[”"」]?[，,:：]?\s*/u,
    (_whole, topic: string) => {
      shouldCompact = true
      return `${topic}，`
    },
  )
  working = working.replace(
    /^([^，。！？!?]{1,48}，)\s*我可以为您整理[^。！？!?]*[。！？!?]\s*/u,
    (_whole, prefix: string) => {
      shouldCompact = true
      return prefix
    },
  )
  working = working.replace(/^明白了[，,]?\s*/u, '')
  working = working.replace(/^我可以为您整理[^。！？!?]*[。！？!?]\s*/u, () => {
    shouldCompact = true
    return ''
  })
  working = working.replace(/^我会围绕[^。！？!?]*[。！？!?]\s*/u, () => {
    shouldCompact = true
    return ''
  })
  working = working.replace(/如果您有特定的环境或需求[^。！？!?]*[。！？!?]?$/u, '')
  working = working.replace(/如有具体疑问[^。！？!?]*[。！？!?]?$/u, '')

  const markerCount = working.match(ENUMERATION_MARKER_RE)?.length ?? 0
  if (!shouldCompact && markerCount < 2) {
    return working.trim()
  }

  const compacted = working
    .replace(
      /^([^，。！？!?]{1,48}，)\s*(首先|其次|另外|最后|一是|二是|三是|四是)[，,、：:\s]*/u,
      '$1',
    )
    .replace(/^(首先|其次|另外|最后|一是|二是|三是|四是)[，,、：:\s]*/u, '')
    .trim()
  const firstSentence =
    compacted.match(/^.*?[。！？!?]/u)?.[0]
    ?? compacted.split(/[；;]/u)[0]
    ?? compacted
  const normalized = firstSentence.trim()
  if (normalized.length <= 96) return normalized
  return `${normalized.slice(0, 95).trimEnd()}…`
}

export function sanitizeChatOutput(text: string): SanitizedChatOutput {
  const cleaned = text
    .trim()
    .replace(CHAT_PREFIX_RE, '')
    .replace(CHAT_SUFFIX_RE, '')
    .replace(WRAPPING_QUOTES_RE, '')
    .trim()

  const withoutQuotes = stripForumQuoteScaffolding(cleaned)
  const normalized = withoutQuotes
    .replace(LEADING_STAGE_DIRECTION_RE, '')
    .replace(LEADING_ALERT_MARKER_RE, '')
    .replace(LEADING_BRACKET_ACTION_RE, '')
    .replace(LEADING_SPEAKER_LABEL_RE, '')
    .replace(INLINE_STAGE_DIRECTION_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const compacted = compactExpositoryReply(normalized)

  return {
    text: compacted,
    looks_meta: META_PATTERNS.some((pattern) => pattern.test(compacted)),
  }
}
