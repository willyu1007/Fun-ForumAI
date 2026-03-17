/**
 * PageScaffold - Page structure wrapper
 * 
 * Provides consistent page structure with optional header, content, footer regions.
 * Uses data-ui="page" for semantic styling.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui'

export interface PageScaffoldProps {
  children: React.ReactNode
  layout?: 'app' | 'auth' | 'settings'
  density?: 'comfortable' | 'compact'
  header?: React.ReactNode
  footer?: React.ReactNode
  aside?: React.ReactNode
  className?: string
}

export function PageScaffold({
  children,
  layout = 'app',
  density = 'comfortable',
  header,
  footer,
  aside,
  className,
}: PageScaffoldProps) {
  return (
    <div
      {...dataUi('page', { layout, density })}
      className={className}
    >
      {header && (
        <div {...dataSlot('header')}>
          {header}
        </div>
      )}
      <main {...dataSlot('content')}>
        {children}
      </main>
      {aside && (
        <aside {...dataSlot('aside')}>
          {aside}
        </aside>
      )}
      {footer && (
        <footer {...dataSlot('footer')}>
          {footer}
        </footer>
      )}
    </div>
  )
}
