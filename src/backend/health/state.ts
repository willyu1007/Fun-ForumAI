export interface AppHealthStatus {
  live: boolean
  ready: boolean
  reason: string | null
}

class HealthState {
  private startupComplete = false
  private explicitNotReady = false
  private explicitNotReadyReason: string | null = null
  private shuttingDown = false
  private fatalErrorReason: string | null = null

  markStartupComplete(): void {
    this.startupComplete = true
    this.explicitNotReady = false
    this.explicitNotReadyReason = null
    this.shuttingDown = false
    this.fatalErrorReason = null
  }

  markNotReady(reason = 'not_ready'): void {
    this.explicitNotReady = true
    this.explicitNotReadyReason = reason
  }

  markShuttingDown(): void {
    this.shuttingDown = true
    this.markNotReady('shutting_down')
  }

  markFatalError(reason: string): void {
    this.fatalErrorReason = reason
    this.markNotReady('fatal_error')
  }

  getAppStatus(): AppHealthStatus {
    if (this.fatalErrorReason) {
      return { live: false, ready: false, reason: 'fatal_error' }
    }
    if (this.shuttingDown) {
      return { live: true, ready: false, reason: 'shutting_down' }
    }
    if (this.explicitNotReady) {
      return { live: true, ready: false, reason: this.explicitNotReadyReason ?? 'not_ready' }
    }
    if (!this.startupComplete) {
      return { live: true, ready: false, reason: 'startup_incomplete' }
    }
    return { live: true, ready: true, reason: null }
  }

  resetForTests(): void {
    this.startupComplete = false
    this.explicitNotReady = false
    this.explicitNotReadyReason = null
    this.shuttingDown = false
    this.fatalErrorReason = null
  }
}

export const healthState = new HealthState()
