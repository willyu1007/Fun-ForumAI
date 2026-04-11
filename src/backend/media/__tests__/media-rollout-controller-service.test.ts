import { afterEach, describe, expect, it } from 'vitest'
import { config } from '../../lib/config.js'
import { InMemoryMediaObservabilityEventRepository } from '../../repos/media-observability-event-repository.js'
import { InMemoryMediaRolloutControllerOverrideRepository } from '../../repos/media-rollout-controller-override-repository.js'
import { MediaObservabilityService } from '../media-observability-service.js'
import { MediaRolloutControllerService } from '../media-rollout-controller-service.js'

describe('MediaRolloutControllerService', () => {
  const originalFeatures = {
    mediaObservabilityV1: config.launch.capabilities.mediaObservabilityV1,
    mediaRolloutControllerV1: config.launch.capabilities.mediaRolloutControllerV1,
    mediaGenerationV1: config.launch.capabilities.mediaGenerationV1,
  }
  const originalController = { ...config.mediaController }

  afterEach(() => {
    Object.assign(config.launch.capabilities, originalFeatures)
    Object.assign(config.mediaController, originalController)
  })

  it('enters boost mode when root-post attach rate is below target and health is stable', async () => {
    Object.assign(config.launch.capabilities, {
      mediaObservabilityV1: true,
      mediaRolloutControllerV1: true,
      mediaGenerationV1: true,
    })
    Object.assign(config.mediaController, {
      rootPostTargetMinRate: 0.35,
      rootPostTargetMaxRate: 0.45,
      estimatedGenerationDailyBudgetCny: 0,
    })

    const observabilityRepo = new InMemoryMediaObservabilityEventRepository()
    const controllerRepo = new InMemoryMediaRolloutControllerOverrideRepository()
    const observabilityService = new MediaObservabilityService({
      mediaObservabilityEventRepo: observabilityRepo,
    })
    const service = new MediaRolloutControllerService({
      mediaObservabilityService: observabilityService,
      mediaRolloutControllerOverrideRepo: controllerRepo,
    })

    const now = new Date('2026-03-22T12:00:00.000Z')
    await observabilityService.record({
      event_type: 'root_post_visual_attempted',
      surface: 'root_post',
      agent_id: 'agent-1',
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    })
    await observabilityService.record({
      event_type: 'root_post_visual_attempted',
      surface: 'root_post',
      agent_id: 'agent-1',
      created_at: new Date(now.getTime() - 60 * 60 * 1000),
    })
    await observabilityService.record({
      event_type: 'root_post_visual_attempted',
      surface: 'root_post',
      agent_id: 'agent-1',
      created_at: new Date(now.getTime() - 50 * 60 * 1000),
    })
    await observabilityService.record({
      event_type: 'root_post_visual_attempted',
      surface: 'root_post',
      agent_id: 'agent-1',
      created_at: new Date(now.getTime() - 40 * 60 * 1000),
    })
    await observabilityService.record({
      event_type: 'root_post_display_linked',
      surface: 'root_post',
      agent_id: 'agent-1',
      created_at: new Date(now.getTime() - 60 * 60 * 1000),
    })
    await observabilityService.record({
      event_type: 'generation_requested',
      surface: 'generation',
      agent_id: 'agent-1',
      metric_value: 1.2,
      created_at: new Date(now.getTime() - 30 * 60 * 1000),
    })
    await observabilityService.record({
      event_type: 'generation_succeeded',
      surface: 'generation',
      agent_id: 'agent-1',
      created_at: new Date(now.getTime() - 20 * 60 * 1000),
    })

    const profile = await service.getEffectiveProfile()

    expect(profile.profile).toBe('boost')
    expect(profile.mode).toBe('AUTO')
    expect(profile.effective.threshold_delta).toBe(-0.2)
    expect(profile.effective.generation_tier).toBe('medium')
    expect(profile.reason).toBe('attach_rate_below_target_band')
  })

  it('honors manual and off overrides over auto decisions', async () => {
    Object.assign(config.launch.capabilities, {
      mediaObservabilityV1: true,
      mediaRolloutControllerV1: true,
      mediaGenerationV1: true,
    })

    const observabilityRepo = new InMemoryMediaObservabilityEventRepository()
    const controllerRepo = new InMemoryMediaRolloutControllerOverrideRepository()
    const observabilityService = new MediaObservabilityService({
      mediaObservabilityEventRepo: observabilityRepo,
    })
    const service = new MediaRolloutControllerService({
      mediaObservabilityService: observabilityService,
      mediaRolloutControllerOverrideRepo: controllerRepo,
    })

    await controllerRepo.create({
      id: 'override-manual',
      mode: 'MANUAL',
      threshold_delta: 0.4,
      allow_generation: false,
      generation_tier: 'none',
      sync_generation_ms_budget: 0,
      allow_private_runtime_projection: false,
      allow_private_inspired_generation: false,
      force_safe_mode: true,
      reason: 'manual lockdown',
      created_by_user_id: 'admin-1',
    })

    const manualProfile = await service.getEffectiveProfile()
    expect(manualProfile.profile).toBe('manual')
    expect(manualProfile.effective.allow_generation).toBe(false)
    expect(manualProfile.effective.force_safe_mode).toBe(true)

    await controllerRepo.replaceActive({
      next_override: {
        id: 'override-off',
        mode: 'OFF',
        reason: 'operator disabled auto control',
        created_by_user_id: 'admin-1',
      },
      release: {
        released_by_user_id: 'admin-1',
      },
    })

    const offProfile = await service.getEffectiveProfile()
    expect(offProfile.profile).toBe('off')
    expect(offProfile.mode).toBe('OFF')
    expect(offProfile.reason).toBe('operator disabled auto control')
  })

  it('preserves AUTO override target bands when boost mode is active', async () => {
    Object.assign(config.launch.capabilities, {
      mediaObservabilityV1: true,
      mediaRolloutControllerV1: true,
      mediaGenerationV1: true,
    })
    Object.assign(config.mediaController, {
      rootPostTargetMinRate: 0.35,
      rootPostTargetMaxRate: 0.45,
      estimatedGenerationDailyBudgetCny: 0,
    })

    const observabilityRepo = new InMemoryMediaObservabilityEventRepository()
    const controllerRepo = new InMemoryMediaRolloutControllerOverrideRepository()
    const observabilityService = new MediaObservabilityService({
      mediaObservabilityEventRepo: observabilityRepo,
    })
    const service = new MediaRolloutControllerService({
      mediaObservabilityService: observabilityService,
      mediaRolloutControllerOverrideRepo: controllerRepo,
    })

    await controllerRepo.create({
      id: 'override-auto-band',
      mode: 'AUTO',
      target_min_rate: 0.5,
      target_max_rate: 0.6,
      reason: 'raise attach target',
      created_by_user_id: 'admin-1',
    })

    for (let index = 0; index < 4; index += 1) {
      await observabilityService.record({
        event_type: 'root_post_visual_attempted',
        surface: 'root_post',
        agent_id: 'agent-1',
        created_at: new Date(`2026-03-22T0${index + 1}:00:00.000Z`),
      })
    }
    await observabilityService.record({
      event_type: 'root_post_display_linked',
      surface: 'root_post',
      agent_id: 'agent-1',
      created_at: new Date('2026-03-22T05:00:00.000Z'),
    })

    const profile = await service.getEffectiveProfile()

    expect(profile.profile).toBe('boost')
    expect(profile.effective.target_min_rate).toBe(0.5)
    expect(profile.effective.target_max_rate).toBe(0.6)
  })

  it('enforces manual safe mode even if the override forgot to disable generation explicitly', async () => {
    Object.assign(config.launch.capabilities, {
      mediaObservabilityV1: true,
      mediaRolloutControllerV1: true,
      mediaGenerationV1: true,
    })

    const observabilityRepo = new InMemoryMediaObservabilityEventRepository()
    const controllerRepo = new InMemoryMediaRolloutControllerOverrideRepository()
    const observabilityService = new MediaObservabilityService({
      mediaObservabilityEventRepo: observabilityRepo,
    })
    const service = new MediaRolloutControllerService({
      mediaObservabilityService: observabilityService,
      mediaRolloutControllerOverrideRepo: controllerRepo,
    })

    await controllerRepo.create({
      id: 'override-force-safe',
      mode: 'MANUAL',
      threshold_delta: 0.1,
      allow_generation: true,
      generation_tier: 'medium',
      sync_generation_ms_budget: 2200,
      allow_private_runtime_projection: true,
      allow_private_inspired_generation: true,
      force_safe_mode: true,
      reason: 'manual safe mode',
      created_by_user_id: 'admin-1',
    })

    const profile = await service.getEffectiveProfile()

    expect(profile.profile).toBe('manual')
    expect(profile.effective.force_safe_mode).toBe(true)
    expect(profile.effective.allow_generation).toBe(false)
    expect(profile.effective.generation_tier).toBe('none')
    expect(profile.effective.sync_generation_ms_budget).toBe(0)
    expect(profile.effective.allow_private_runtime_projection).toBe(false)
    expect(profile.effective.allow_private_inspired_generation).toBe(false)
    expect(profile.effective.threshold_delta).toBe(0.35)
  })
})
