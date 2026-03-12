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
    const paths = collectPaths(input.after_config)
    const lint_warnings = new Set<string>()

    const highRiskTouched = paths.some((path) =>
      HIGH_RISK_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}.`)))

    if (highRiskTouched) {
      lint_warnings.add('high_risk_config_surface_touched')
    }

    const proactive = input.after_config.proactive
    if (isPlainRecord(proactive) && proactive.enabled === true) {
      lint_warnings.add('proactive_config_requires_review')
    }

    const publish = input.after_config.publish
    if (isPlainRecord(publish) && publish.enabled === true) {
      lint_warnings.add('publish_config_requires_review')
    }

    const privacy = input.after_config.privacy
    if (isPlainRecord(privacy) && typeof privacy.public_disclosure_cap === 'number') {
      lint_warnings.add('public_disclosure_cap_changed')
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
