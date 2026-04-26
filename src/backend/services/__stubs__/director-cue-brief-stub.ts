/**
 * T-210 M3 — director compile stub.
 *
 * Stub stays at the module path the real `DirectorCueBrief` (T-212) will
 * occupy. T-212's swap is a single-file replacement; the consumer's import
 * line never changes.
 *
 * Returns a fixed "preview unavailable" payload. Frontend renders an info
 * banner explaining the preview becomes meaningful once T-212 ships.
 */

import type { PublicDiscussionCueDomain } from '../../programming/cue/types.js'

export interface DirectorCueBriefDryRunResult {
  status: 'preview_unavailable'
  cue_id: string
  source: 'stub_until_t212'
  note: string
}

export interface DirectorCueBriefService {
  compile(
    cue: PublicDiscussionCueDomain,
    options: { dryRun: true },
  ): Promise<DirectorCueBriefDryRunResult>
}

export const directorCueBriefStub: DirectorCueBriefService = {
  async compile(cue, _options) {
    return {
      status: 'preview_unavailable',
      cue_id: cue.id,
      source: 'stub_until_t212',
      note: 'Director brief preview becomes available after T-212 cue-worker-runtime ships.',
    }
  },
}
