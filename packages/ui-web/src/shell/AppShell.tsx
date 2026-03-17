/**
 * AppShell - Application shell with regions
 * 
 * Provides TopBar, LeftRail, ContentRegion, RightRail regions.
 * Business logic (notifications, user menu) should be passed as widgets.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui'

export interface AppShellProps {
  children: React.ReactNode
  topBar?: React.ReactNode
  leftRail?: React.ReactNode
  rightRail?: React.ReactNode
  footer?: React.ReactNode
  leftRailOpen?: boolean
  showRightRail?: boolean
  className?: string
}

export function AppShell({
  children,
  topBar,
  leftRail,
  rightRail,
  footer,
  leftRailOpen = true,
  showRightRail = false,
  className,
}: AppShellProps) {
  return (
    <div
      {...dataUi('page', { layout: 'app' })}
      className={className}
      data-left-rail-open={leftRailOpen || undefined}
    >
      {/* Top Bar */}
      {topBar && (
        <header {...dataSlot('header')} className="h-14 border-b shrink-0">
          {topBar}
        </header>
      )}

      {/* Main area with sidebars */}
      <div className="flex flex-1 min-h-0">
        {/* Left Rail */}
        {leftRail && (
          <aside
            {...dataSlot('aside')}
            data-rail="left"
            className={`hidden md:block border-r shrink-0 transition-[width] ${leftRailOpen ? 'w-60' : 'w-0 overflow-hidden'}`}
          >
            {leftRail}
          </aside>
        )}

        {/* Content Region */}
        <main {...dataSlot('content')} className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>

        {/* Right Rail */}
        {showRightRail && rightRail && (
          <aside
            {...dataSlot('aside')}
            data-rail="right"
            className="hidden lg:block w-80 border-l shrink-0"
          >
            {rightRail}
          </aside>
        )}
      </div>

      {/* Footer */}
      {footer && (
        <footer {...dataSlot('footer')} className="border-t shrink-0">
          {footer}
        </footer>
      )}
    </div>
  )
}
