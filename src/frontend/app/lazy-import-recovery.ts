import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

type LazyModule<T extends ComponentType<object>> = Promise<{ default: T }>
type LazyModuleFactory<T extends ComponentType<object>> = () => LazyModule<T>

const DYNAMIC_IMPORT_RELOAD_PREFIX = 'funforum:dynamic-import-reload:'
const RECOVERABLE_DYNAMIC_IMPORT_MARKERS = [
  'chunkloaderror',
  'failed to fetch dynamically imported module',
  'importing a module script failed',
]

let reloadHandler: (() => void) | null = null

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function buildDynamicImportReloadKey(reloadKey: string): string {
  return `${DYNAMIC_IMPORT_RELOAD_PREFIX}${reloadKey}`
}

export function isRecoverableDynamicImportError(error: unknown): boolean {
  const rawMessage =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? `${error.name} ${error.message}`
        : ''

  if (!rawMessage) {
    return false
  }

  const normalizedMessage = rawMessage.toLowerCase()
  return RECOVERABLE_DYNAMIC_IMPORT_MARKERS.some((marker) => normalizedMessage.includes(marker))
}

function clearDynamicImportReloadAttempt(reloadKey: string): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }

  storage.removeItem(buildDynamicImportReloadKey(reloadKey))
}

function consumeDynamicImportReloadAttempt(reloadKey: string): boolean {
  const storage = getSessionStorage()
  if (!storage) {
    return false
  }

  const storageKey = buildDynamicImportReloadKey(reloadKey)
  if (storage.getItem(storageKey) === '1') {
    storage.removeItem(storageKey)
    return false
  }

  storage.setItem(storageKey, '1')
  return true
}

function triggerDynamicImportReload(): void {
  if (reloadHandler) {
    reloadHandler()
    return
  }

  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}

export function recoverDynamicImportErrorOnce(error: unknown, reloadKey: string): boolean {
  if (!isRecoverableDynamicImportError(error)) {
    return false
  }

  if (!consumeDynamicImportReloadAttempt(reloadKey)) {
    clearDynamicImportReloadAttempt(reloadKey)
    return false
  }

  triggerDynamicImportReload()
  return true
}

export async function loadWithDynamicImportRecovery<T extends ComponentType<object>>(
  loader: LazyModuleFactory<T>,
  reloadKey: string,
): LazyModule<T> {
  try {
    const module = await loader()
    clearDynamicImportReloadAttempt(reloadKey)
    return module
  } catch (error) {
    if (recoverDynamicImportErrorOnce(error, reloadKey)) {
      return new Promise<never>(() => {})
    }

    clearDynamicImportReloadAttempt(reloadKey)
    throw error
  }
}

export function lazyWithDynamicImportRecovery<T extends ComponentType<object>>(
  loader: LazyModuleFactory<T>,
  reloadKey: string,
): LazyExoticComponent<T> {
  return lazy(() => loadWithDynamicImportRecovery(loader, reloadKey))
}

export function setDynamicImportReloadHandlerForTests(handler: (() => void) | null): void {
  reloadHandler = handler
}
