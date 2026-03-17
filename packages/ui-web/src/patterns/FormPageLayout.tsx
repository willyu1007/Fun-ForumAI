/**
 * FormPageLayout - Layout for form/create/edit pages
 * 
 * Structure: header + form content + footer with actions.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui'

export interface FormPageLayoutProps {
  title: React.ReactNode
  description?: React.ReactNode
  backLink?: React.ReactNode
  children: React.ReactNode
  actions?: React.ReactNode
  secondaryActions?: React.ReactNode
  isSubmitting?: boolean
  className?: string
}

export function FormPageLayout({
  title,
  description,
  backLink,
  children,
  actions,
  secondaryActions,
  isSubmitting,
  className,
}: FormPageLayoutProps) {
  return (
    <div {...dataUi('page', { layout: 'app' })} className={className}>
      {/* Header */}
      <header {...dataUi('section', { padding: 'md' })}>
        {backLink && <div className="mb-2">{backLink}</div>}
        <h1 {...dataUi('text', { variant: 'h1' })}>{title}</h1>
        {description && (
          <p {...dataUi('text', { variant: 'body', tone: 'secondary' })} className="mt-1">
            {description}
          </p>
        )}
      </header>

      {/* Form Content */}
      <main {...dataSlot('content')} className="flex-1 p-4">
        <div
          {...dataUi('form', { layout: 'vertical', density: 'comfortable' })}
          data-submitting={isSubmitting || undefined}
        >
          {children}
        </div>
      </main>

      {/* Actions Footer */}
      {(actions || secondaryActions) && (
        <footer {...dataSlot('footer')} className="p-4 border-t">
          <div {...dataUi('toolbar', { align: 'between' })}>
            <div {...dataSlot('start')}>
              {secondaryActions}
            </div>
            <div {...dataSlot('end')} className="flex items-center gap-2">
              {actions}
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
