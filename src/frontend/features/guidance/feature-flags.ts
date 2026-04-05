import { isFrontendFlagEnabled } from '@/shared/config/frontend-flags'

export function isGuidanceEnabled(): boolean {
  return isFrontendFlagEnabled('VITE_FF_GUIDANCE_V1')
}

export function isGuidanceBellEnabled(): boolean {
  return isGuidanceEnabled() && isFrontendFlagEnabled('VITE_FF_GUIDANCE_BELL_V1')
}
