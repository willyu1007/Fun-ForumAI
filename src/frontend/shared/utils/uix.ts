import { UIX_CLASS_MAP } from './uix-map'

export function uix(key: string): string {
  return UIX_CLASS_MAP[key] ?? key
}
