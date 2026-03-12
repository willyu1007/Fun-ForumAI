const CHAT_PREFIX_RE = /^\[CHAT\]\s*[:：]?\s*/i
const CHAT_SUFFIX_RE = /\s*\[END_OF_CHAT\]\s*$/i
const WRAPPING_QUOTES_RE = /^["'“”‘’`]+|["'“”‘’`]+$/g
const LEADING_STAGE_DIRECTION_RE = /^(?:(?:（[^）\n]{1,24}）|\([^)\n]{1,24}\))\s*)+/u
const LEADING_ALERT_MARKER_RE = /^\[(?:!|！)\]\s*/u
const LEADING_BRACKET_ACTION_RE =
  /^\[(?:笑|停顿|沉默|思考|思索|挑眉|皱眉|点头|摇头|叹气|耸肩|看向[^\]\n]{0,8}|望向[^\]\n]{0,8}|转向[^\]\n]{0,8})\]\s*/u
const LEADING_BRACKET_SPEAKER_TAG_RE = /^(?:\[[^\]\n]{2,24}\]|【[^】\n]{2,24}】)\s*/u
const LEADING_MARKDOWN_SPEAKER_LABEL_RE =
  /^(?:(?:\*\*|__|`)[^*_\n`]{1,24}(?:\*\*|__|`))\s*[:：]\s*/u
const LEADING_SPEAKER_LABEL_RE =
  /^(?:\[[^\]\n]{1,24}\]|【[^】\n]{1,24}】|[A-Za-z0-9_\-\u4E00-\u9FFF]{2,24})\s*[:：]\s*/u
const INLINE_STAGE_DIRECTION_RE =
  /[（(](?:[^）)\n]{0,24}(?:轻抚|前倾|后仰|神情|目光|表情|身体|手指|双手|双眸|眼睛|眼神|视线|右手|左手|手臂|胸前|额前|碎发|发丝|发梢|敲击|摊手|挑眉|耸肩|点头|点头示意|颔首|摇头|皱眉|停顿|低声|沉吟|沉思|思索|认真思考|略作思索|若有所思|苦笑|微笑|微微一笑|轻笑|眨眼|眼睛亮晶晶|虚握|撩起|捋起|拨开|拢了拢|抬眸|垂眸|环顾|环顾四周|环视|扫视|挥手示意|叹气|追问|补充|插话|看向|看着|望向|望着|转向|朝[^\n）)]{0,12}|向[^\n）)]{0,16}|注视|凝视|紧盯)[^）)\n]{0,28}|略作思索|眼睛亮晶晶的?|若有所思|认真思考|环顾四周|环视一圈|追问|补充|插话|停顿)[）)]/gu
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
const STRUCTURED_REPLY_RE = /(?:\n|^\s*(?:[-*•·]|\d+[.)]|[一二三四五六七八九十]+、|（\d+）))/mu

export interface SanitizedChatOutput {
  text: string
  looks_meta: boolean
}

const TRAILING_STAGE_DIRECTION_RE = /[（(](?:思考片刻|稍作思考|停顿片刻|沉默片刻|片刻沉默|略一沉吟)[）)]/gu
const ENUMERATION_BREAK_RE = /(。|！|？|；)\s*((?:首先|其次|另外|最后|一是|二是|三是|四是))/gu

function normalizeChatWhitespace(text: string): string {
  const normalizedLines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())

  const keptLines: string[] = []

  for (const line of normalizedLines) {
    if (!line) {
      if (keptLines.length > 0 && keptLines[keptLines.length - 1] !== '') {
        keptLines.push('')
      }
      continue
    }

    keptLines.push(line)
  }

  return keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
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
  const hasStructuredBreaks = STRUCTURED_REPLY_RE.test(working)
  if (hasStructuredBreaks) {
    return working.trim()
  }

  if (!shouldCompact && markerCount < 2) {
    return working.trim()
  }

  if (!shouldCompact && working.length < 120) {
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

function splitIntoSentenceBeats(text: string): string[] {
  return text.match(/[^。！？!?；;]+[。！？!?；;]?/gu)?.map((part) => part.trim()).filter(Boolean) ?? [text]
}

export function formatChatReplyForReadability(text: string): string {
  const normalized = normalizeChatWhitespace(text)
  if (!normalized || normalized.includes('\n')) return normalized

  const enumerated = normalized.replace(ENUMERATION_BREAK_RE, '$1\n$2')
  if (enumerated !== normalized) {
    return normalizeChatWhitespace(enumerated)
  }

  if (normalized.length < 16) return normalized

  const beats = splitIntoSentenceBeats(normalized)
  if (beats.length < 2 || beats.length > 3) return normalized
  if (beats.some((beat) => beat.length < 5)) return normalized

  return beats.join('\n')
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
    .replace(LEADING_BRACKET_SPEAKER_TAG_RE, '')
    .replace(LEADING_MARKDOWN_SPEAKER_LABEL_RE, '')
    .replace(LEADING_SPEAKER_LABEL_RE, '')
    .replace(INLINE_STAGE_DIRECTION_RE, '')
    .replace(TRAILING_STAGE_DIRECTION_RE, '')
  const normalizedWithParagraphs = normalizeChatWhitespace(normalized)
  const compacted = compactExpositoryReply(normalizedWithParagraphs)

  return {
    text: compacted,
    looks_meta: META_PATTERNS.some((pattern) => pattern.test(compacted)),
  }
}
