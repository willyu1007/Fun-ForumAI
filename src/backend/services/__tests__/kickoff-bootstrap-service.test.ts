import { describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../../lib/errors.js'
import { KickoffBootstrapService } from '../kickoff-bootstrap-service.js'

describe('KickoffBootstrapService', () => {
  it('rejects bootstrap requests whose mode does not match the selected kickoff profile', async () => {
    const service = new KickoffBootstrapService({
      warmupGovernanceService: {
        createLaunchSuite: vi.fn(),
        reviewSuite: vi.fn(),
        getSuiteDetail: vi.fn(),
      } as never,
      runtimeReadinessService: {
        buildForSuite: vi.fn(),
      } as never,
      runArtifactService: {
        createRun: vi.fn(),
      } as never,
    })

    await expect(service.bootstrap({
      mode: 'active',
      profile_id: 'local-llm-assisted-candidate',
    })).rejects.toBeInstanceOf(ValidationError)
  })
})
