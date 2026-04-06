import { describe, expect, it, vi } from 'vitest'

describe('k8s process cleanup', () => {
  it('registers child cleanup and unregisters on exit', async () => {
    const stopChildProcess = vi.fn(async () => undefined)
    vi.doMock('../../k8s-smoke-utils.mjs', () => ({
      stopChildProcess,
    }))

    const mod = await import('../k8s-process-cleanup.mjs')
    const child = {
      exitCode: null,
      once(event: string, callback: () => void) {
        if (event === 'exit') {
          ;(this as { onExit?: () => void }).onExit = callback
        }
        return this
      },
    }

    expect(mod.__cleanupCountForTest()).toBe(0)
    const unregister = mod.registerChildProcessCleanup(child as never)
    expect(mod.__cleanupCountForTest()).toBe(1)

    unregister()
    expect(mod.__cleanupCountForTest()).toBe(0)

    mod.registerChildProcessCleanup(child as never)
    expect(mod.__cleanupCountForTest()).toBe(1)
    ;(child as { onExit?: () => void }).onExit?.()
    expect(mod.__cleanupCountForTest()).toBe(0)
    expect(stopChildProcess).not.toHaveBeenCalled()
  })
})
