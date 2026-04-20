import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  validateCanonicalLaunchBuildProfile,
  validateDevOnlyStartupHardening,
  validateFrontendDeliveryAssets,
  validateLocalKindMediaPersistence,
  validateLaunchMembershipBootstrapAssets,
  validateLaunchRuntimeContracts,
  validateKickoffAssets,
  validateLaunchRuntimeOverlay,
  validatePackagingWireup,
  validatePublishWorkflowWireup,
  validateStrictSemanticConvergence,
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
    expect(validateKickoffAssets()).toMatchObject({ ok: true })
    expect(validateWorkerAssets()).toMatchObject({ ok: true })
    expect(validatePackagingWireup()).toMatchObject({ ok: true })
    expect(validatePublishWorkflowWireup()).toMatchObject({ ok: true })
    expect(validateDevOnlyStartupHardening()).toMatchObject({ ok: true })
    expect(validateStrictSemanticConvergence()).toMatchObject({ ok: true })
  })

  it('wires the warm-up closure verifier into staging checks', () => {
    const script = readFileSync('scripts/verify-launch-readiness.mjs', 'utf8')
    expect(script).toContain('Warm-up closure verifier')
    expect(script).toContain('scripts/verify-warmup-closure.mjs')
  })
})
