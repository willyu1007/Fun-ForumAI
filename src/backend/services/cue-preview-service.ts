/**
 * T-210 M3 — pre-publish preview chain.
 *
 * Runs the 5-stage preview chain per cue-editor-admin/02-architecture.md §6:
 *   1. schema           - CuePatchV1Schema.parse(body.patch)
 *   2. deterministic    - forbidden, locked, time bounds, community existence
 *   3. load             - LoadSignalService.get (stub returns green)
 *   4. media            - re-run picker filter on cue's currently attached media
 *   5. director_compile - DirectorCueBrief.compile(dryRun=true) (stub)
 *
 * Stage 1 / 2 short-circuit on `error`. Stages 3 / 4 / 5 are non-fatal:
 * stage 4 emits warnings; 3 and 5 always succeed under stubs and emit a
 * `source: 'stub_until_t21X'` marker so frontend can render an info banner.
 */

import { ZodError } from 'zod'
import { CuePatchV1Schema, isForbiddenCueField, type CuePatchV1 } from '../programming/cue/cue-patch.js'
import { validateLockedFields } from '../programming/cue/locked-fields-validator.js'
import { extractEditableFromCue } from './cue-editor-service.js'
import { MediaPickerService } from './media-picker-service.js'
import type {
  CueRepository,
  PublicDiscussionCueChangeDomain,
} from '../repos/cue-repository.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { LoadSignalService } from './__stubs__/load-signal-service-stub.js'
import type { DirectorCueBriefService } from './__stubs__/director-cue-brief-stub.js'
import type { PublicDiscussionCueDomain } from '../programming/cue/types.js'

export type PreviewStageId =
  | 'schema'
  | 'deterministic'
  | 'load'
  | 'media'
  | 'director_compile'

export type PreviewStageStatus = 'ok' | 'warning' | 'error'

export interface PreviewStage {
  stage: PreviewStageId
  status: PreviewStageStatus
  payload: unknown
  /** Present when the stage came from a stub (T-210 placeholder for T-212/T-213). */
  source?: 'stub_until_t212' | 'stub_until_t213'
}

export interface PreviewResponse {
  cue_id: string
  stages: PreviewStage[]
  overall: 'ok' | 'has_warnings' | 'has_errors'
}

export interface CuePreviewServiceDeps {
  repo: CueRepository
  mediaAssetRepo: MediaAssetRepository
  loadSignalService: LoadSignalService
  directorCueBrief: DirectorCueBriefService
  now?: () => Date
}

export class CuePreviewService {
  private readonly repo: CueRepository
  private readonly mediaAssetRepo: MediaAssetRepository
  private readonly loadSignal: LoadSignalService
  private readonly directorBrief: DirectorCueBriefService
  private readonly now: () => Date

  constructor(deps: CuePreviewServiceDeps) {
    this.repo = deps.repo
    this.mediaAssetRepo = deps.mediaAssetRepo
    this.loadSignal = deps.loadSignalService
    this.directorBrief = deps.directorCueBrief
    this.now = deps.now ?? (() => new Date())
  }

  async preview(input: { cueId: string; rawPatch: unknown }): Promise<PreviewResponse> {
    const stages: PreviewStage[] = []

    // ---- Stage 1: schema ----
    let patch: CuePatchV1
    try {
      patch = CuePatchV1Schema.parse(input.rawPatch)
      stages.push({ stage: 'schema', status: 'ok', payload: { ok: true } })
    } catch (err) {
      const issues = err instanceof ZodError ? err.issues : [{ message: String(err), path: [] }]
      stages.push({
        stage: 'schema',
        status: 'error',
        payload: { issues },
      })
      return finalize(input.cueId, stages)
    }

    // ---- Stage 2: deterministic ----
    const cue = await this.repo.findCueById(input.cueId)
    if (!cue) {
      stages.push({
        stage: 'deterministic',
        status: 'error',
        payload: { issues: [`cue ${input.cueId} not found`] },
      })
      return finalize(input.cueId, stages)
    }

    const detIssues: string[] = []

    // Forbidden fields backstop (schema layer also rejects but keep server-side
    // check honest).
    for (const key of Object.keys(patch.partial)) {
      if (isForbiddenCueField(key)) detIssues.push(`forbidden partial.${key}`)
    }
    for (const removed of patch.removed_fields ?? []) {
      if (isForbiddenCueField(removed)) detIssues.push(`forbidden removed_fields.${removed}`)
    }

    // Locked-fields against current state (preview path uses the current
    // locked_fields, mirroring what the update service does).
    const oldEditable = extractEditableFromCue(cue)
    const lockViolations = validateLockedFields({
      oldPartial: oldEditable,
      patch,
      lockedPaths: cue.locked_fields ?? [],
    })
    for (const v of lockViolations) {
      detIssues.push(`locked: ${v.patchPath} <- ${v.lockedBy}`)
    }

    // Time bounds (only when patch supplies trigger_at; otherwise keep current
    // value and skip).
    const now = this.now()
    const schedule = await this.repo.findScheduleById(cue.schedule_id)
    if (schedule) {
      const triggerAt = patch.partial.trigger_at
        ? new Date(patch.partial.trigger_at)
        : new Date(cue.trigger_at)
      if (Number.isNaN(triggerAt.getTime())) {
        detIssues.push('trigger_at is not a valid datetime')
      } else {
        if (triggerAt.getTime() < now.getTime() - 60_000) {
          detIssues.push('trigger_at is in the past')
        }
        if (
          triggerAt.getTime() < schedule.date_range_start.getTime() ||
          triggerAt.getTime() > schedule.date_range_end.getTime()
        ) {
          detIssues.push('trigger_at out of schedule window')
        }
      }
    } else {
      detIssues.push(`schedule ${cue.schedule_id} not found`)
    }

    if (detIssues.length > 0) {
      stages.push({
        stage: 'deterministic',
        status: 'error',
        payload: { issues: detIssues },
      })
      return finalize(input.cueId, stages)
    }
    stages.push({ stage: 'deterministic', status: 'ok', payload: { ok: true } })

    // ---- Stage 3: load ----
    try {
      const snap = await this.loadSignal.get(
        cue.community_id ?? cue.scope.community_id ?? '',
        patch.partial.trigger_at ?? cue.trigger_at,
      )
      stages.push({
        stage: 'load',
        status: snap.status === 'red' ? 'warning' : 'ok',
        payload: snap,
        ...(snap.source === 'stub_until_t213' ? { source: 'stub_until_t213' as const } : {}),
      })
    } catch (err) {
      stages.push({
        stage: 'load',
        status: 'warning',
        payload: { error: (err as Error).message },
      })
    }

    // ---- Stage 4: media ----
    const attached = await this.repo.listMediaForCue(cue.id)
    const rejectedMedia: Array<{ asset_id: string; reasons: string[] }> = []
    for (const item of attached) {
      const asset = await this.mediaAssetRepo.findById(item.asset_id)
      if (!asset) {
        rejectedMedia.push({ asset_id: item.asset_id, reasons: ['asset_not_found'] })
        continue
      }
      if (!MediaPickerService.isPickable(asset)) {
        const reasons: string[] = []
        if (asset.lifecycle_status !== 'active') reasons.push(`lifecycle:${asset.lifecycle_status}`)
        if (!asset.storage_key) reasons.push('storage_unreadable')
        if (
          asset.visibility_policy === 'private_only' ||
          asset.visibility_policy === 'blocked'
        ) {
          reasons.push(`visibility:${asset.visibility_policy}`)
        }
        rejectedMedia.push({ asset_id: item.asset_id, reasons })
      }
    }
    stages.push({
      stage: 'media',
      status: rejectedMedia.length > 0 ? 'warning' : 'ok',
      payload: {
        attached_count: attached.length,
        rejected: rejectedMedia,
      },
    })

    // ---- Stage 5: director_compile ----
    try {
      // Apply patch to a shallow copy of cue so the dry-run sees the would-be
      // committed state; the director stub doesn't actually use this, but
      // T-212's real implementation will.
      const projected = projectCue(cue, patch)
      const briefResult = await this.directorBrief.compile(projected, { dryRun: true })
      stages.push({
        stage: 'director_compile',
        status: 'ok',
        payload: briefResult,
        ...(briefResult.source === 'stub_until_t212'
          ? { source: 'stub_until_t212' as const }
          : {}),
      })
    } catch (err) {
      stages.push({
        stage: 'director_compile',
        status: 'warning',
        payload: { error: (err as Error).message },
      })
    }

    return finalize(input.cueId, stages)
  }
}

function projectCue(cue: PublicDiscussionCueDomain, patch: CuePatchV1): PublicDiscussionCueDomain {
  // Shallow-merge patch.partial onto cue; absent removed_fields semantic is
  // handled here only at top-level (mirrors applyCuePatch). This is enough
  // for the stub dry-run.
  const merged = { ...cue } as Record<string, unknown>
  for (const [k, v] of Object.entries(patch.partial)) {
    merged[k] = v
  }
  for (const removed of patch.removed_fields ?? []) {
    if (removed in merged) merged[removed] = undefined
  }
  return merged as PublicDiscussionCueDomain
}

function finalize(cueId: string, stages: PreviewStage[]): PreviewResponse {
  let overall: PreviewResponse['overall'] = 'ok'
  if (stages.some((s) => s.status === 'error')) overall = 'has_errors'
  else if (stages.some((s) => s.status === 'warning')) overall = 'has_warnings'
  return { cue_id: cueId, stages, overall }
}

// Re-export for tests / consumer typing convenience.
export type { PublicDiscussionCueChangeDomain }
