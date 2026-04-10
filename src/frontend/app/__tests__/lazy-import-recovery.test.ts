import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import {
  buildDynamicImportReloadKey,
  isRecoverableDynamicImportError,
  loadWithDynamicImportRecovery,
  setDynamicImportReloadHandlerForTests,
} from '../lazy-import-recovery'

function createResolvedModule() {
  const Component: ComponentType = () => null
  return { default: Component }
}

describe('lazy import recovery', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    setDynamicImportReloadHandlerForTests(null)
  })

  afterEach(() => {
    window.sessionStorage.clear()
    setDynamicImportReloadHandlerForTests(null)
    vi.restoreAllMocks()
  })

  it('recognizes stale dynamic import failures', () => {
    expect(
      isRecoverableDynamicImportError(new TypeError('Failed to fetch dynamically imported module')),
    ).toBe(true)
    expect(isRecoverableDynamicImportError(new Error('ChunkLoadError: Loading chunk 42 failed.'))).toBe(true)
    expect(isRecoverableDynamicImportError(new Error('network exploded somewhere else'))).toBe(false)
  })

  it('reloads once on the first recoverable dynamic import failure', async () => {
    const reload = vi.fn()
    setDynamicImportReloadHandlerForTests(reload)

    void loadWithDynamicImportRecovery(
      () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
      'route:post-detail',
    )
    await Promise.resolve()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(buildDynamicImportReloadKey('route:post-detail'))).toBe('1')
  })

  it('does not enter a reload loop after the retry sentinel is set', async () => {
    const reload = vi.fn()
    setDynamicImportReloadHandlerForTests(reload)
    window.sessionStorage.setItem(buildDynamicImportReloadKey('route:post-detail'), '1')

    await expect(
      loadWithDynamicImportRecovery(
        () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
        'route:post-detail',
      ),
    ).rejects.toThrow('Failed to fetch dynamically imported module')

    expect(reload).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(buildDynamicImportReloadKey('route:post-detail'))).toBeNull()
  })

  it('clears any retry sentinel after a successful import', async () => {
    const resolvedModule = createResolvedModule()
    window.sessionStorage.setItem(buildDynamicImportReloadKey('route:post-detail'), '1')

    await expect(loadWithDynamicImportRecovery(() => Promise.resolve(resolvedModule), 'route:post-detail')).resolves.toBe(
      resolvedModule,
    )

    expect(window.sessionStorage.getItem(buildDynamicImportReloadKey('route:post-detail'))).toBeNull()
  })
})
