import { describe, expect, it } from 'vitest'
import {
  validateFrontendDeliveryAssets,
  validateFrontendBuildProfile,
  validateLaunchMembershipBootstrapAssets,
  validateLaunchWarmStartAssets,
  validateLaunchRuntimeOverlay,
  validatePackagingWireup,
  validateWorkerAssets,
} from '../launch-readiness.mjs'

describe('launch readiness repo checks', () => {
  it('accepts the launch runtime overlays and frontend profiles', () => {
    expect(validateLaunchRuntimeOverlay('env/values/staging-launch.yaml', 'staging')).toMatchObject({
      ok: true,
    })
    expect(validateLaunchRuntimeOverlay('env/values/prod-launch.yaml', 'prod')).toMatchObject({
      ok: true,
    })
    expect(validateFrontendBuildProfile('staging-launch')).toMatchObject({
      ok: true,
    })
    expect(validateFrontendBuildProfile('prod-launch')).toMatchObject({
      ok: true,
    })
  })

  it('requires launch bootstrap, worker assets, and packaging proof wiring', () => {
    expect(validateFrontendDeliveryAssets()).toMatchObject({ ok: true })
    expect(validateLaunchMembershipBootstrapAssets()).toMatchObject({ ok: true })
    expect(validateLaunchWarmStartAssets()).toMatchObject({ ok: true })
    expect(validateWorkerAssets()).toMatchObject({ ok: true })
    expect(validatePackagingWireup()).toMatchObject({ ok: true })
  })
})
