import { create } from 'zustand'
import type {
  DevFrontendFlagConfig,
  DevFrontendFlagPreset,
  FrontendFlagKey,
  FrontendFlagValue,
} from '@/shared/config/frontend-flags'
import {
  readActiveDevFrontendFlagConfig,
  readPersistedDevFrontendFlagConfig,
  resolveFrontendFlagValuesForConfig,
  writePersistedDevFrontendFlagConfig,
} from '@/shared/config/frontend-flags'

function cloneConfig(config: DevFrontendFlagConfig): DevFrontendFlagConfig {
  return {
    preset: config.preset,
    overrides: { ...config.overrides },
  }
}

interface DevFrontendFlagsState {
  panelOpen: boolean
  draftConfig: DevFrontendFlagConfig
  activeConfig: DevFrontendFlagConfig
  setPanelOpen: (open: boolean) => void
  setPreset: (preset: DevFrontendFlagPreset) => void
  setFlagValue: (key: FrontendFlagKey, value: FrontendFlagValue) => void
  resetToInherit: () => void
  resetToActive: () => void
}

const initialDraftConfig = cloneConfig(readPersistedDevFrontendFlagConfig())
const initialActiveConfig = cloneConfig(readActiveDevFrontendFlagConfig())

export const useDevFrontendFlagsStore = create<DevFrontendFlagsState>((set, get) => ({
  panelOpen: false,
  draftConfig: initialDraftConfig,
  activeConfig: initialActiveConfig,
  setPanelOpen: (open) => {
    if (open) {
      const nextDraft = cloneConfig(readPersistedDevFrontendFlagConfig())
      set({ panelOpen: open, draftConfig: nextDraft })
      return
    }
    set({ panelOpen: open })
  },
  setPreset: (preset) => {
    const current = cloneConfig(get().draftConfig)
    const next: DevFrontendFlagConfig = {
      preset,
      overrides: { ...current.overrides },
    }
    writePersistedDevFrontendFlagConfig(next)
    set({ draftConfig: next })
  },
  setFlagValue: (key, value) => {
    const current = cloneConfig(get().draftConfig)
    const effectiveValues = resolveFrontendFlagValuesForConfig(current)
    const nextOverrides =
      current.preset === 'custom'
        ? { ...current.overrides }
        : { ...effectiveValues }
    nextOverrides[key] = value
    const next: DevFrontendFlagConfig = {
      preset: 'custom',
      overrides: nextOverrides,
    }
    writePersistedDevFrontendFlagConfig(next)
    set({ draftConfig: next })
  },
  resetToInherit: () => {
    const next: DevFrontendFlagConfig = { preset: 'inherit', overrides: {} }
    writePersistedDevFrontendFlagConfig(next)
    set({ draftConfig: next })
  },
  resetToActive: () => {
    const next = cloneConfig(get().activeConfig)
    writePersistedDevFrontendFlagConfig(next)
    set({ draftConfig: next })
  },
}))
