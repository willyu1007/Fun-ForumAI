import { guidanceBellEnabled, guidanceEnabled } from '@/shared/config/frontend-capabilities'

export function isGuidanceEnabled(): boolean {
  return guidanceEnabled
}

export function isGuidanceBellEnabled(): boolean {
  return guidanceBellEnabled
}
