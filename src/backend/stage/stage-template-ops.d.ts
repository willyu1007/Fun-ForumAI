export type StageTemplateBinding = {
  community_slug: string
  slot?: string
  binding_type: 'core' | 'seasonal'
} | null

export interface StageTemplateManifestItem {
  id: string
  category: string
  path: string
  status: 'launch' | 'hidden'
  binding: StageTemplateBinding
}

export interface StageTemplateManifest {
  version: string
  generated_at?: string
  templates: StageTemplateManifestItem[]
  seasonal_slots: Array<{
    slot: string
    community_slug: string
  }>
  rotation_audit?: Array<{
    at: string
    open_count: number
    replaced: Array<{ slot: string; template_id: string }>
    activated: Array<{ slot: string; template_id: string }>
  }>
}

export class StageTemplateValidationError extends Error {}

export function readYamlFile<T = unknown>(filePath: string): T
export function writeYamlFileAtomic(filePath: string, payload: unknown): void

export function rotateStageTemplates(
  manifest: StageTemplateManifest,
  openCount: number,
): {
  manifest: StageTemplateManifest
  replaced: Array<{ slot: string; template_id: string }>
  activated: Array<{ slot: string; template_id: string }>
}

export function buildStageTemplateDistPayload(
  baseDir: string,
  manifest: StageTemplateManifest,
  exportedAt: string,
): {
  library: {
    version: string
    exported_at: string
    templates: Array<Record<string, unknown>>
  }
  launch: {
    version: string
    exported_at: string
    templates: Array<Record<string, unknown>>
  }
  exported_templates: number
  launch_templates: number
}

export function applySeasonRotationAtomic(input: {
  base_dir: string
  open_count: number
  dry_run: boolean
  now_iso?: string
  inject_failure_step?: 'after_library_commit' | 'after_dist_commit' | 'after_manifest_commit'
}): {
  open_count: number
  dry_run: boolean
  replaced: Array<{ slot: string; template_id: string }>
  activated: Array<{ slot: string; template_id: string }>
  exported_templates: number
  launch_templates: number
}
