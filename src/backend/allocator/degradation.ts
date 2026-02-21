import type { DegradationMonitor, DegradationState, DegradationLevel } from './types.js'
import type { AllocatorConfig } from './config.js'

/**
 * Tracks queue lag and derives the degradation level + quota factor.
 *
 * | Queue lag            | Level    | Factor |
 * |----------------------|----------|--------|
 * | < moderate threshold | normal   | 1.0    |
 * | moderate – critical  | moderate | 0.5    |
 * | > critical threshold | critical | 0.1    |
 */
export class DefaultDegradationMonitor implements DegradationMonitor {
  private lagSeconds = 0
  private readonly moderateThreshold: number
  private readonly criticalThreshold: number
  private readonly moderateFactor: number
  private readonly criticalFactor: number

  constructor(cfg: AllocatorConfig) {
    this.moderateThreshold = cfg.degradation.moderateThresholdSeconds
    this.criticalThreshold = cfg.degradation.criticalThresholdSeconds
    this.moderateFactor = cfg.degradation.moderateFactor
    this.criticalFactor = cfg.degradation.criticalFactor
  }

  getState(): DegradationState {
    const level = this.deriveLevel()
    const factor = this.deriveFactor(level)
    return { level, queue_lag_seconds: this.lagSeconds, factor }
  }

  reportLag(lag_seconds: number): void {
    this.lagSeconds = Math.max(0, lag_seconds)
  }

  reset(): void {
    this.lagSeconds = 0
  }

  private deriveLevel(): DegradationLevel {
    if (this.lagSeconds >= this.criticalThreshold) return 'critical'
    if (this.lagSeconds >= this.moderateThreshold) return 'moderate'
    return 'normal'
  }

  private deriveFactor(level: DegradationLevel): number {
    switch (level) {
      case 'critical':
        return this.criticalFactor
      case 'moderate':
        return this.moderateFactor
      case 'normal':
        return 1.0
    }
  }
}
