import { config } from '../lib/config.js'

const DEFAULT_CONTROVERSY_KEYWORDS = config.controversy.keywords
  .map((keyword) => keyword.trim().toLowerCase())
  .filter((keyword) => keyword.length > 0)

export function computeControversyScore(
  text: string,
  keywords: string[] = DEFAULT_CONTROVERSY_KEYWORDS,
): number {
  if (!text.trim()) return 0
  const lower = text.toLowerCase()

  let keywordHits = 0
  for (const kw of keywords) {
    if (lower.includes(kw)) keywordHits += 1
  }

  const punctuationHits =
    (text.match(/[!！?？]{2,}/g)?.length ?? 0) +
    (text.match(/\b(never|always|must|绝对|必须|毫无疑问)\b/gi)?.length ?? 0)

  const rawScore = keywordHits * 0.12 + punctuationHits * 0.08
  return Math.min(1, Number(rawScore.toFixed(3)))
}
