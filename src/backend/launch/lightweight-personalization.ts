import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { ValidationError } from '../lib/errors.js'
import { resolveLaunchContractPath } from './contract-paths.js'

const DEFAULT_LIGHTWEIGHT_PERSONALIZATION_PATH = resolveLaunchContractPath({
  bundle_slug: 'p1-lightweight-personalization-and-relation-hints',
  file_name: 'lightweight_personalization_and_relation_hints.v1.yaml',
})

const lightweightSignalWeightSchema = z.enum(['low_weight', 'medium_weight', 'high_weight'])

const rankingSignalsSchema = z.object({
  viewer_agent_id: lightweightSignalWeightSchema,
  follow_state: lightweightSignalWeightSchema,
  relation_context: lightweightSignalWeightSchema,
  storyline_revisit: lightweightSignalWeightSchema,
  creator_note_revisit: lightweightSignalWeightSchema,
}).strict()

const lightweightPersonalizationSchema = z.object({
  version: z.number().int().positive(),
  draft_status: z.string().trim().min(1),
  notes: z.array(z.string().trim().min(1)).default([]),
  viewer_context: z.object({
    default_source: z.string().trim().min(1),
    actor_resolution_order: z.array(z.string().trim().min(1)).min(1),
  }).strict(),
  public_view_events: z.object({
    retention_days: z.number().int().positive(),
    recent_window_days: z.number().int().positive(),
    exposure_surfaces: z.array(z.string().trim().min(1)).min(1),
    open_targets: z.array(z.string().trim().min(1)).min(1),
  }).strict(),
  ranking_signals: rankingSignalsSchema,
  surface_targets: z.array(z.string().trim().min(1)).min(1),
  relation_hint_fields: z.array(z.string().trim().min(1)).min(1),
  offline_candidate_pool: z.object({
    source: z.string().trim().min(1),
    mode: z.string().trim().min(1),
    online_takeover_allowed: z.boolean(),
    validation_gates: z.array(z.string().trim().min(1)).min(1),
  }).strict(),
  rollback: z.object({
    personalization_mode: z.string().trim().min(1),
  }).strict(),
}).strict()

export type LightweightPersonalizationRuntime = z.infer<typeof lightweightPersonalizationSchema>

let cachedRuntime: LightweightPersonalizationRuntime | null = null

function readYaml(pathname: string): unknown {
  return parseYaml(readFileSync(pathname, 'utf8'))
}

function toValidationMessage(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).join('; ')
}

export function getLightweightPersonalizationRuntime(
  pathname = DEFAULT_LIGHTWEIGHT_PERSONALIZATION_PATH,
): LightweightPersonalizationRuntime {
  if (pathname === DEFAULT_LIGHTWEIGHT_PERSONALIZATION_PATH && cachedRuntime) {
    return cachedRuntime
  }
  const parsed = lightweightPersonalizationSchema.safeParse(readYaml(pathname))
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid lightweight personalization contract: ${toValidationMessage(parsed.error)}`,
    )
  }
  if (pathname === DEFAULT_LIGHTWEIGHT_PERSONALIZATION_PATH) {
    cachedRuntime = parsed.data
  }
  return parsed.data
}
