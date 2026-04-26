/**
 * T-213 M1 — adapter that lets `CueAdmissionController` (which depends on the
 * stub-shaped `LoadSignalService`) consume live `AdmissionLoadService` output
 * without changing its public seam.
 *
 * Why this exists: T-212 froze `CueAdmissionController.loadSignalService` as
 * a `LoadSignalService` (returning `{ status, community_id, trigger_at_iso,
 * source }`). T-213's live computation produces a richer `LoadSnapshot`. The
 * adapter narrows the live shape to the stub-compatible projection so M1 can
 * move admission off the always-green stub today, without M2's cached
 * pathway. M2 layers the cached `LoadSignalService` on top for preview /
 * Cue Board consumers; admission keeps consuming live snapshots.
 */

import type { LoadSignalService } from '../../services/load-signal-service.js'
import type { AdmissionLoadService } from './admission-load-service.js'

export function adaptAdmissionLoadAsLoadSignal(
  service: AdmissionLoadService,
): LoadSignalService {
  return {
    async get(communityId, triggerAtIso) {
      const snapshot = await service.compute(communityId)
      return {
        status: snapshot.state,
        community_id: communityId,
        trigger_at_iso: triggerAtIso ?? null,
        // Audit-only tag distinguishing live snapshots from the legacy stub.
        source: 'admission_load_service:live',
      }
    },
  }
}
