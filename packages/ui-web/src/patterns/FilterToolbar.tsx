/**
 * FilterToolbar - Filter and action toolbar for list pages
 * 
 * Structure: start slot (filters), end slot (actions).
 * Uses data-ui="toolbar".
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui'

export interface FilterToolbarProps {
  filters?: React.ReactNode
  actions?: React.ReactNode
  wrap?: boolean
  className?: string
}

export function FilterToolbar({
  filters,
  actions,
  wrap = true,
  className,
}: FilterToolbarProps) {
  return (
    <div
      {...dataUi('toolbar', { align: 'between', wrap: wrap ? 'wrap' : 'nowrap' })}
      className={className}
    >
      {filters && (
        <div {...dataSlot('start')} className="flex items-center gap-2 flex-wrap">
          {filters}
        </div>
      )}
      {actions && (
        <div {...dataSlot('end')} className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
