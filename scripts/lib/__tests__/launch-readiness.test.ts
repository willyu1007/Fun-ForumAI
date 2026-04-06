import { describe, expect, it } from 'vitest'
import {
  validateCanonicalLaunchBuildProfile,
  validateDevOnlyStartupHardening,
  validateFrontendDeliveryAssets,
  validateLocalKindMediaPersistence,
  validateLaunchMembershipBootstrapAssets,
  validateLaunchRuntimeContracts,
  validateLaunchWarmStartAssets,
  validateLaunchRuntimeOverlay,
  validatePackagingWireup,
  validatePublishWorkflowWireup,
  validateWorkerAssets,
} from '../launch-readiness.mjs'

describe('launch readiness repo checks', () => {
  it('accepts the launch runtime overlays, runtime contracts, and canonical frontend profile', () => {
    expect(validateLaunchRuntimeOverlay('env/values/staging-launch.yaml', 'staging')).toMatchObject({
      ok: true,
    })
    expect(validateLaunchRuntimeOverlay('env/values/prod-launch.yaml', 'prod')).toMatchObject({
      ok: true,
    })
    expect(validateLaunchRuntimeContracts()).toMatchObject({
      ok: true,
    })
    expect(validateCanonicalLaunchBuildProfile()).toMatchObject({
      ok: true,
    })
  })

  it('requires launch bootstrap, worker assets, publish wireup, and startup hardening', () => {
    expect(validateFrontendDeliveryAssets()).toMatchObject({ ok: true })
    expect(validateLocalKindMediaPersistence()).toMatchObject({ ok: true })
    expect(validateLaunchMembershipBootstrapAssets()).toMatchObject({ ok: true })
    expect(validateLaunchWarmStartAssets()).toMatchObject({ ok: true })
    expect(validateWorkerAssets()).toMatchObject({ ok: true })
    expect(validatePackagingWireup()).toMatchObject({ ok: true })
    expect(validatePublishWorkflowWireup()).toMatchObject({ ok: true })
    expect(validateDevOnlyStartupHardening()).toMatchObject({ ok: true })
  })
})
