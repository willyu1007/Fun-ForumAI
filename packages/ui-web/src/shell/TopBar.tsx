/**
 * TopBar - Application top navigation bar
 * 
 * Provides slots for logo, navigation, and action widgets.
 * Actual widgets (notifications, user menu) should be passed as props.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui'

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
      className={className}
    >
      {/* Left: menu trigger + logo */}
      <div {...dataSlot('start')} className="flex items-center gap-2">
        {mobileMenuTrigger}
        {logo}
      </div>

      {/* Center: navigation (optional) */}
      {navigation && (
        <div {...dataSlot('center')} className="hidden md:flex items-center gap-1">
          {navigation}
        </div>
      )}

      {/* Right: actions */}
      <div {...dataSlot('end')} className="flex items-center gap-2">
        {actions}
      </div>
    </div>
  )
}
