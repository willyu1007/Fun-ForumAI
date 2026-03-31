import { afterEach, beforeEach } from 'vitest'

interface MemoryStorage extends Storage {
  readonly __store: Map<string, string>
}

function createMemoryStorage(): MemoryStorage {
  const store = new Map<string, string>()

  return {
    get __store() {
      return store
    },
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(String(key)) ?? null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(String(key))
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value))
    },
  }
}

const canonicalLocalStorage = createMemoryStorage()
const canonicalSessionStorage = createMemoryStorage()

function installStorage(name: 'localStorage' | 'sessionStorage', storage: Storage): void {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    value: storage,
  })

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, {
      configurable: true,
      enumerable: true,
      value: storage,
    })
  }
}

function hasStorageMethods(value: unknown): value is Storage {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.getItem === 'function'
    && typeof record.setItem === 'function'
    && typeof record.removeItem === 'function'
    && typeof record.clear === 'function'
    && typeof record.key === 'function'
}

function restoreCanonicalStorages(): void {
  installStorage('localStorage', canonicalLocalStorage)
  installStorage('sessionStorage', canonicalSessionStorage)
}

function ensureWorkingStorages(): void {
  if (!hasStorageMethods(globalThis.localStorage)) {
    installStorage('localStorage', canonicalLocalStorage)
  }
  if (!hasStorageMethods(globalThis.sessionStorage)) {
    installStorage('sessionStorage', canonicalSessionStorage)
  }
}

ensureWorkingStorages()

beforeEach(() => {
  restoreCanonicalStorages()
  canonicalLocalStorage.clear()
  canonicalSessionStorage.clear()
})

afterEach(() => {
  restoreCanonicalStorages()
  canonicalLocalStorage.clear()
  canonicalSessionStorage.clear()
})
