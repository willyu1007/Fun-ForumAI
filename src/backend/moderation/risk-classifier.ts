import type { RiskClassifier, RiskCategory } from './types.js'
import { WEIGHTED_KEYWORDS, type WeightedKeyword } from './config.js'

/**
 * Stage 2: Keyword-weight risk classifier (MVP).
 *
 * Scans text for weighted keywords, accumulates score (capped at 1.0),
 * and collects matched risk categories.
 *
 * Production: replace with ML classifier or external API (OpenAI Moderation,
 * Perspective API).
 */
export class KeywordRiskClassifier implements RiskClassifier {
  private keywords: WeightedKeyword[]

  constructor(keywords?: WeightedKeyword[]) {
    this.keywords = keywords ?? WEIGHTED_KEYWORDS
  }

  classify(text: string): { score: number; categories: RiskCategory[] } {
    const lower = text.toLowerCase()
    let score = 0
    const categorySet = new Set<RiskCategory>()

    for (const kw of this.keywords) {
      if (lower.includes(kw.pattern.toLowerCase())) {
        score += kw.weight
        categorySet.add(kw.category)
      }
    }

    score = Math.min(1.0, score)

    const categories: RiskCategory[] =
      categorySet.size > 0 ? Array.from(categorySet) : ['clean']

    return { score, categories }
  }
}
