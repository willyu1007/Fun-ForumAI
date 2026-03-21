/**
 * TopBar - Application top navigation bar
 * 
 * Provides slots for logo, navigation, and action widgets.
 * Actual widgets (notifications, user menu) should be passed as props.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui.js'

export interface TopBarProps {
  logo?: React.ReactNode
  navigation?: React.ReactNode
  actions?: React.ReactNode
  mobileMenuTrigger?: React.ReactNode
  className?: string
}

export function TopBar({
  logo,
  navigation,
  actions,
  mobileMenuTrigger,
  className,
}: TopBarProps) {
  return (
    <div
      {...dataUi('toolbar', { align: 'between' })}
      className={[
        'flex items-center justify-between gap-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(18rem,36rem)_minmax(0,1fr)] md:gap-4',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
      {/* Left: menu trigger + logo */}
      <div {...dataSlot('start')} className="flex min-w-0 items-center gap-2 md:justify-self-start">
        {mobileMenuTrigger}
        {logo}
      </div>

      {/* Center: navigation (optional) */}
      {navigation && (
        <div {...dataSlot('center')} className="hidden min-w-0 md:flex md:items-center md:justify-center md:px-3">
          {navigation}
        </div>
      )}

      {/* Right: actions */}
      <div {...dataSlot('end')} className="flex min-w-0 items-center gap-2 md:justify-self-end">
        {actions}
      </div>
    </div>
  )
}
