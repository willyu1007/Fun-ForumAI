import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  compactErrorMessage,
  recordRuntimeOperation,
  resetRuntimeOperationRecorder,
  setRuntimeOperationRecorder,
} from '../runtime-observability.js'

afterEach(() => {
  resetRuntimeOperationRecorder()
})

describe('runtime-observability', () => {
  it('is a no-op by default — runtime callers stay silent without container wiring', () => {
    expect(() =>
      recordRuntimeOperation({
        severity: 'error',
        source: 'runtime_loop',
        operation: 'tick',
        status: 'failed',
      }),
    ).not.toThrow()
  })

  it('forwards calls to the active recorder', () => {
    const spy = vi.fn()
    setRuntimeOperationRecorder(spy)

    recordRuntimeOperation({
      severity: 'warn',
      source: 'agent_executor',
      operation: 'parse_output',
      status: 'failed',
      agent_id: 'a1',
    })

    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0]![0]).toMatchObject({
      severity: 'warn',
      source: 'agent_executor',
      operation: 'parse_output',
      agent_id: 'a1',
    })
  })

  it('swallows recorder throws — the runtime path never sees the error', () => {
    setRuntimeOperationRecorder(() => {
      throw new Error('observability backend down')
    })

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() =>
      recordRuntimeOperation({
        severity: 'critical',
        source: 'event_queue',
        operation: 'dead_letter',
        status: 'dead_lettered',
      }),
    ).not.toThrow()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('compactErrorMessage truncates very long messages and tolerates non-Error values', () => {
    expect(compactErrorMessage(new Error('short'))).toBe('short')
    const long = 'x'.repeat(2000)
    const compacted = compactErrorMessage(new Error(long))
    expect(compacted.length).toBeLessThanOrEqual(512)
    expect(compacted.endsWith('…')).toBe(true)
    expect(compactErrorMessage('plain string')).toBe('plain string')
    expect(compactErrorMessage({ code: 42 })).toBe('[object Object]')
  })
})
