import type {
  BiographyVisualMotifIntensity,
  BiographyVisualMotifType,
} from '@/api/types'

const MOTIF_CLASSES: Record<BiographyVisualMotifType, string> = {
  PAPER: 'biography-motif-paper',
  SHADOW: 'biography-motif-shadow',
  STAGE: 'biography-motif-stage',
  LIGHT: 'biography-motif-light',
  STAMP: 'biography-motif-stamp',
  DIALOGUE: 'biography-motif-dialogue',
  THREAD: 'biography-motif-thread',
}

const INTENSITY_CLASSES: Record<BiographyVisualMotifIntensity, string> = {
  LOW: 'biography-motif-intensity-low',
  MEDIUM: 'biography-motif-intensity-medium',
  HIGH: 'biography-motif-intensity-high',
}

export function resolveMotifClasses(
  motif:
    | {
        motif_type?: BiographyVisualMotifType
        intensity?: BiographyVisualMotifIntensity
      }
    | undefined,
): string {
  const motifClass = motif?.motif_type
    ? MOTIF_CLASSES[motif.motif_type]
    : MOTIF_CLASSES.PAPER
  const intensityClass = motif?.intensity
    ? INTENSITY_CLASSES[motif.intensity]
    : INTENSITY_CLASSES.MEDIUM
  return `biography-motif ${motifClass} ${intensityClass}`
}
