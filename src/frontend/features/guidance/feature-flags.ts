export function isGuidanceEnabled(): boolean {
  return import.meta.env.VITE_FF_GUIDANCE_V1 === 'true'
}

export function isGuidanceBellEnabled(): boolean {
  return isGuidanceEnabled() && import.meta.env.VITE_FF_GUIDANCE_BELL_V1 === 'true'
}
