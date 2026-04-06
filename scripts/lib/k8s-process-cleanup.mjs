#!/usr/bin/env node

import { stopChildProcess } from '../k8s-smoke-utils.mjs'

const CLEANUP_CALLBACKS = new Set()
let hooksInstalled = false

function installHooks() {
  if (hooksInstalled) return
  hooksInstalled = true

  const runCleanupAndExit = async (exitCode, rethrow) => {
    try {
      await Promise.allSettled(Array.from(CLEANUP_CALLBACKS, (callback) => callback()))
    } finally {
      CLEANUP_CALLBACKS.clear()
    }

    if (rethrow) throw rethrow
    process.exit(exitCode)
  }

  process.once('SIGINT', () => {
    void runCleanupAndExit(130)
  })
  process.once('SIGTERM', () => {
    void runCleanupAndExit(143)
  })
  process.once('beforeExit', () => {
    if (CLEANUP_CALLBACKS.size === 0) return
    return Promise.allSettled(Array.from(CLEANUP_CALLBACKS, (callback) => callback())).then(() => {
      CLEANUP_CALLBACKS.clear()
    })
  })
  process.once('uncaughtException', (error) => {
    void runCleanupAndExit(1, error)
  })
}

export function registerChildProcessCleanup(child) {
  installHooks()
  const callback = async () => {
    await stopChildProcess(child)
  }
  CLEANUP_CALLBACKS.add(callback)
  child.once('exit', () => {
    CLEANUP_CALLBACKS.delete(callback)
  })
  return () => {
    CLEANUP_CALLBACKS.delete(callback)
  }
}

export function __cleanupCountForTest() {
  return CLEANUP_CALLBACKS.size
}
