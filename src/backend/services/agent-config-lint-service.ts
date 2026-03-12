import type { AgentConfigReview } from '../repos/types.js'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectPaths(
  value: Record<string, unknown>,
  prefix = '',
  out: string[] = [],
): string[] {
  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    out.push(path)
    if (isPlainRecord(nested)) {
      collectPaths(nested, path, out)
    }
  }
  return out
}

function collectChangedPaths(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix = '',
  out: string[] = [],
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key
    const beforeValue = before[key]
    const afterValue = after[key]
    const beforeRecord = isPlainRecord(beforeValue)
    const afterRecord = isPlainRecord(afterValue)

    if (beforeRecord && afterRecord) {
      collectChangedPaths(beforeValue, afterValue, path, out)
      continue
    }

    if (beforeRecord || afterRecord) {
      out.push(path)
      if (beforeRecord) collectPaths(beforeValue, path, out)
      if (afterRecord) collectPaths(afterValue, path, out)
      continue
    }

    if (!Object.is(beforeValue, afterValue)) {
      out.push(path)
    }
  }
  return out
}

function collectStringLeaves(
  value: unknown,
  out: string[] = [],
): string[] {
  if (typeof value === 'string') {
    out.push(value)
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringLeaves(item, out)
    }
    return out
  }
  if (!isPlainRecord(value)) {
    return out
  }
  for (const nested of Object.values(value)) {
    collectStringLeaves(nested, out)
  }
  return out
}

function getValueAtPath(value: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.')
  let current: unknown = value
  for (const segment of segments) {
    if (!isPlainRecord(current)) {
      return undefined
    }
    current = current[segment]
  }
  return current
}

const REJECT_RULES: Array<{ warning: string; pattern: RegExp }> = [
  { warning: 'semantic_ignore_privacy_rejected', pattern: /\b(?:ignore|bypass|override)\b.{0,20}\b(?:privacy|disclosure|safety)\b/i },
  { warning: 'semantic_quote_owner_rejected', pattern: /\b(?:quote|repeat|relay|cite)\b.{0,20}\b(?:owner|private chat|dm)\b/i },
  { warning: 'semantic_publicize_private_chat_rejected', pattern: /\b(?:publicize|publish|share|expose|leak)\b.{0,20}\b(?:owner|private chat|private dm|private conversation)\b/i },
  { warning: 'semantic_bypass_disclosure_rejected', pattern: /\b(?:disable|bypass|ignore)\b.{0,20}\b(?:disclosure restriction|disclosure cap|privacy cap)\b/i },
  { warning: 'semantic_ignore_privacy_rejected', pattern: /(?:忽略|绕过).{0,8}(?:隐私|披露|安全)/ },
  { warning: 'semantic_quote_owner_rejected', pattern: /(?:引用|转述).{0,8}(?:owner|主人|私聊|私信)/i },
  { warning: 'semantic_publicize_private_chat_rejected', pattern: /(?:公开|发布|曝光|泄露).{0,8}(?:owner|主人|私聊|私信)/i },
  { warning: 'semantic_bypass_disclosure_rejected', pattern: /(?:关闭|绕过|忽略).{0,8}(?:披露限制|公开限制|隐私上限)/ },
]

const HIGH_RISK_PREFIXES = [
  'prompt_overrides',
  'publish',
  'proactive',
  'privacy',
  'identity.contract',
]

export class AgentConfigLintService {
  lint(input: {
    before_config: Record<string, unknown>
    after_config: Record<string, unknown>
  }): AgentConfigReview {
    const changedPaths = collectChangedPaths(input.before_config, input.after_config)
    const lint_warnings = new Set<string>()
    const changedFragments = changedPaths.flatMap((path) => collectStringLeaves(getValueAtPath(input.after_config, path)))

    const highRiskTouched = changedPaths.some((path) =>
      HIGH_RISK_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}.`)))

    if (highRiskTouched) {
      lint_warnings.add('high_risk_config_surface_touched')
    }

    const proactive = input.after_config.proactive
    const proactiveTouched = changedPaths.some((path) => path === 'proactive' || path.startsWith('proactive.'))
    if (proactiveTouched && isPlainRecord(proactive) && proactive.enabled === true) {
      lint_warnings.add('proactive_config_requires_review')
    }

    const publish = input.after_config.publish
    const publishTouched = changedPaths.some((path) => path === 'publish' || path.startsWith('publish.'))
    if (publishTouched && isPlainRecord(publish) && publish.enabled === true) {
      lint_warnings.add('publish_config_requires_review')
    }

    const privacy = input.after_config.privacy
    if (
      changedPaths.includes('privacy.public_disclosure_cap')
      && isPlainRecord(privacy)
      && typeof privacy.public_disclosure_cap === 'number'
    ) {
      lint_warnings.add('public_disclosure_cap_changed')
    }

    const matchedRejectWarnings = REJECT_RULES
      .filter((rule) => changedFragments.some((fragment) => rule.pattern.test(fragment)))
      .map((rule) => rule.warning)
    for (const warning of matchedRejectWarnings) {
      lint_warnings.add(warning)
    }

    if (matchedRejectWarnings.length > 0) {
      return {
        risk_level: 'HIGH',
        review_status: 'REJECTED',
        review_case_id: null,
        lint_warnings: [...lint_warnings],
      }
    }

    if (highRiskTouched) {
      return {
        risk_level: 'HIGH',
        review_status: 'PENDING',
        review_case_id: null,
        lint_warnings: [...lint_warnings],
      }
    }

    return {
      risk_level: 'LOW',
      review_status: 'NOT_REQUIRED',
      review_case_id: null,
      lint_warnings: [...lint_warnings],
    }
  }
}
