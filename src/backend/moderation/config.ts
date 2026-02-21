import type { CommunityThresholds, RiskCategory } from './types.js'

// ─── Default thresholds ─────────────────────────────────────

export const DEFAULT_THRESHOLDS: CommunityThresholds = {
  low_max_score: 0.3,
  medium_max_score: 0.7,
  auto_reject_score: 0.95,
}

// ─── Keyword blacklist (immediate block) ────────────────────

export const BLOCK_KEYWORDS: string[] = [
  // Placeholder entries — production uses an external config file or DB table.
  // These are intentionally abstract category markers, not real slurs.
  '__BLOCK_HATE__',
  '__BLOCK_CSAM__',
  '__BLOCK_ILLEGAL__',
]

// ─── Keyword weight map (risk scoring) ──────────────────────

export interface WeightedKeyword {
  pattern: string
  weight: number
  category: RiskCategory
}

export const WEIGHTED_KEYWORDS: WeightedKeyword[] = [
  { pattern: '__HATE_TERM__', weight: 0.6, category: 'hate_harassment' },
  { pattern: '__HARASS_TERM__', weight: 0.5, category: 'hate_harassment' },
  { pattern: '__SEXUAL_TERM__', weight: 0.7, category: 'sexual_minors' },
  { pattern: '__SCAM_TERM__', weight: 0.5, category: 'scam_manipulation' },
  { pattern: '__DANGER_TERM__', weight: 0.6, category: 'illegal_dangerous' },
  { pattern: '__SPAM_TERM__', weight: 0.4, category: 'spam_flooding' },
]

// ─── PII patterns ───────────────────────────────────────────

export const PII_PATTERNS: { name: string; regex: RegExp; severity: 'block' | 'flag' }[] = [
  { name: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, severity: 'flag' },
  { name: 'phone_intl', regex: /\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, severity: 'flag' },
  { name: 'ssn_us', regex: /\b\d{3}-\d{2}-\d{4}\b/g, severity: 'block' },
]

// ─── URL blacklist ──────────────────────────────────────────

export const URL_BLACKLIST_PATTERNS: RegExp[] = [
  /https?:\/\/(?:www\.)?malicious-example\.com/gi,
  /https?:\/\/(?:www\.)?phishing-example\.org/gi,
]
