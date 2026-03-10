export function isGuidanceEnabled(): boolean {
  return import.meta.env.VITE_FF_GUIDANCE_V1 === 'true'
}
