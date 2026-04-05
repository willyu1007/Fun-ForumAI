/**
 * AppShell - Application shell with regions
 * 
 * Provides TopBar, LeftRail, ContentRegion, RightRail regions.
 * Business logic (notifications, user menu) should be passed as widgets.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui.js'

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
      className={className ? `flex min-h-screen flex-col ${className}` : 'flex min-h-screen flex-col'}
      data-testid="app-shell"
      data-left-rail-open={leftRailOpen || undefined}
    >
      {/* Top Bar */}
      {topBar && (
        <header {...dataSlot('header')} className="shrink-0" style={{ marginBottom: 0 }}>
          {topBar}
        </header>
      )}

      {/* Main area with sidebars */}
      <div className="flex min-h-0 flex-1">
        {/* Left Rail */}
        {leftRail && (
          <aside
            {...dataSlot('aside')}
            data-rail="left"
            className="hidden shrink-0 md:block"
          >
            {leftRail}
          </aside>
        )}

        {/* Content Region */}
        <main
          {...dataSlot('content')}
          className="flex-1 min-w-0"
          data-testid="app-shell-content"
        >
          {children}
        </main>

        {/* Right Rail */}
        {showRightRail && rightRail && (
          <aside
            {...dataSlot('aside')}
            data-rail="right"
            className="hidden shrink-0 lg:block"
          >
            {rightRail}
          </aside>
        )}
      </div>

      {/* Footer */}
      {footer && (
        <footer {...dataSlot('footer')} className="shrink-0" style={{ marginTop: 0 }}>
          {footer}
        </footer>
      )}
    </div>
  )
}
