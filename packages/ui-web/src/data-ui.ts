/**
 * Data-ui attribute helpers for React components.
 * 
 * Usage:
 *   <div {...dataUi('card', { variant: 'outlined', padding: 'md' })} />
 *   <div {...dataSlot('header')} />
 */

import type { UiRole, UiAttrsForRole } from '@fun-forum/ui-contract'

type DataUiAttributes<R extends UiRole> = {
  'data-ui': R
} & {
  [K in keyof UiAttrsForRole<R> as `data-${string & K}`]?: UiAttrsForRole<R>[K]
}

export function dataUi<R extends UiRole>(
  role: R,
  attrs?: Partial<UiAttrsForRole<R>>
): DataUiAttributes<R> {
  const result: Record<string, string> = { 'data-ui': role }

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined) {
        result[`data-${key}`] = String(value)
      }
    }
  }

  return result as DataUiAttributes<R>
}

export function dataSlot(slot: string): { 'data-slot': string } {
  return { 'data-slot': slot }
}
