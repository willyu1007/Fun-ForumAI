/**
 * T-213 M5 — `SyntheticLoadInjector` test helper.
 *
 * Validates the test-only utility that lets E2E pipelines drive admission
 * outcomes through any cell of the decision matrix without fabricating
 * realistic counter values.
 */

import { describe, expect, it } from 'vitest'
import { AdmissionLoadService } from '../admission-load-service.js'
import { SyntheticLoadInjector } from '../__test_support__/synthetic-load-injector.js'
import { InMemoryCueRepository } from '../../../repos/cue-repository.js'
import { InMemoryPostRepository } from '../../../repos/post-repository.js'

describe('SyntheticLoadInjector', () => {
  it('overrides the snapshot state and global_state when forced', async () => {
    const cueRepo = new InMemoryCueRepository()
    const postRepo = new InMemoryPostRepository()
    const base = new AdmissionLoadService({ cueRepo, postRepo })
    const injector = new SyntheticLoadInjector(base)
    injector.forceState('red')
    const snap = await injector.compute('c1')
    expect(snap.state).toBe('red')
    expect(snap.global_state).toBe('red')
  })

  it('lets the global state diverge from the community state', async () => {
    const cueRepo = new InMemoryCueRepository()
    const postRepo = new InMemoryPostRepository()
    const base = new AdmissionLoadService({ cueRepo, postRepo })
    const injector = new SyntheticLoadInjector(base)
    injector.forceState('yellow', { global: 'red' })
    const snap = await injector.compute('c1')
    expect(snap.state).toBe('yellow')
    expect(snap.global_state).toBe('red')
  })

  it('reset() restores the underlying service output', async () => {
    const cueRepo = new InMemoryCueRepository()
    const postRepo = new InMemoryPostRepository()
    const base = new AdmissionLoadService({ cueRepo, postRepo })
    const injector = new SyntheticLoadInjector(base)
    injector.forceState('red')
    expect((await injector.compute('c1')).state).toBe('red')
    injector.reset()
    expect((await injector.compute('c1')).state).toBe('green')
  })

  it('oneShot mode applies once then falls back', async () => {
    const cueRepo = new InMemoryCueRepository()
    const postRepo = new InMemoryPostRepository()
    const base = new AdmissionLoadService({ cueRepo, postRepo })
    const injector = new SyntheticLoadInjector(base)
    injector.forceState('red', { oneShot: true })
    expect((await injector.compute('c1')).state).toBe('red')
    expect((await injector.compute('c1')).state).toBe('green')
  })
})
