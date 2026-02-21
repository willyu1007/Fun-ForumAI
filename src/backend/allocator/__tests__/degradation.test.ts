import { describe, it, expect, beforeEach } from 'vitest'
import { DefaultDegradationMonitor } from '../degradation.js'
import { DEFAULT_ALLOCATOR_CONFIG } from '../config.js'

describe('DefaultDegradationMonitor', () => {
  let monitor: DefaultDegradationMonitor

  beforeEach(() => {
    monitor = new DefaultDegradationMonitor(DEFAULT_ALLOCATOR_CONFIG)
  })

  it('defaults to normal level with factor 1.0', () => {
    const state = monitor.getState()
    expect(state.level).toBe('normal')
    expect(state.factor).toBe(1.0)
    expect(state.queue_lag_seconds).toBe(0)
  })

  it('reports moderate when lag >= 120s and < 300s', () => {
    monitor.reportLag(150)
    const state = monitor.getState()
    expect(state.level).toBe('moderate')
    expect(state.factor).toBe(0.5)
  })

  it('reports critical when lag >= 300s', () => {
    monitor.reportLag(400)
    const state = monitor.getState()
    expect(state.level).toBe('critical')
    expect(state.factor).toBe(0.1)
  })

  it('boundary: 120s is moderate', () => {
    monitor.reportLag(120)
    expect(monitor.getState().level).toBe('moderate')
  })

  it('boundary: 300s is critical', () => {
    monitor.reportLag(300)
    expect(monitor.getState().level).toBe('critical')
  })

  it('boundary: 119s is still normal', () => {
    monitor.reportLag(119)
    expect(monitor.getState().level).toBe('normal')
  })

  it('recovers to normal when lag drops', () => {
    monitor.reportLag(400)
    expect(monitor.getState().level).toBe('critical')

    monitor.reportLag(50)
    expect(monitor.getState().level).toBe('normal')
    expect(monitor.getState().factor).toBe(1.0)
  })

  it('reset() brings back to normal', () => {
    monitor.reportLag(400)
    monitor.reset()
    const state = monitor.getState()
    expect(state.level).toBe('normal')
    expect(state.queue_lag_seconds).toBe(0)
  })

  it('negative lag is clamped to 0', () => {
    monitor.reportLag(-10)
    expect(monitor.getState().queue_lag_seconds).toBe(0)
    expect(monitor.getState().level).toBe('normal')
  })
})
