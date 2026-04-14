/**
 * DetailPageLayout - Layout for detail/show pages
 * 
 * Structure: header + tabs/sections + content + optional sidebar.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui.js'

export interface DetailPageLayoutProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  headerActions?: React.ReactNode
  backLink?: React.ReactNode
  hideHeader?: boolean
  tabs?: React.ReactNode
  showTabsDivider?: boolean
  children: React.ReactNode
  sidebar?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function DetailPageLayout({
  title,
  subtitle,
  headerActions,
  backLink,
  hideHeader = false,
  tabs,
  showTabsDivider = true,
  children,
  sidebar,
  footer,
  className,
}: DetailPageLayoutProps) {
  return (
    <div {...dataUi('page', { layout: 'app' })} className={className}>
      {!hideHeader && (
        <header {...dataUi('section', { padding: 'md' })}>
          {backLink && <div className="mb-2">{backLink}</div>}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 {...dataUi('text', { variant: 'h1' })}>{title}</h1>
              {subtitle && (
                <p {...dataUi('text', { variant: 'body', tone: 'secondary' })} className="mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            {headerActions && (
              <div {...dataUi('toolbar', { align: 'end' })}>
                {headerActions}
              </div>
            )}
          </div>
        </header>
      )}

      {/* Tabs */}
      {tabs && (
        <div
          {...dataUi('tabs', { variant: 'line' })}
          className={showTabsDivider ? 'border-b' : undefined}
        >
          {tabs}
        </div>
      )}

      {/* Content with optional sidebar */}
      <div className="flex flex-1">
        <main {...dataSlot('content')} className="flex-1 p-4">
          {children}
        </main>
        {sidebar && (
          <aside {...dataSlot('aside')} className="w-80 border-l p-4">
            {sidebar}
          </aside>
        )}
      </div>

      {/* Footer */}
      {footer && (
        <footer {...dataSlot('footer')} className="p-4 border-t">
          {footer}
        </footer>
      )}
    </div>
  )
}
