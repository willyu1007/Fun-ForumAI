/**
 * PageHeader - Consistent page header
 * 
 * Structure: title, optional description, optional actions slot.
 * Uses data-ui="section" with header semantics.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui.js'

export interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  backLink?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  backLink,
  className,
}: PageHeaderProps) {
  return (
    <header
      {...dataUi('section', { variant: 'default', padding: 'md' })}
      className={className}
    >
      {backLink && (
        <div {...dataSlot('header')}>
          {backLink}
        </div>
      )}
      <div {...dataSlot('content')} className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 {...dataUi('text', { variant: 'h1' })}>{title}</h1>
          {description && (
            <p {...dataUi('text', { variant: 'body', tone: 'secondary' })} className="mt-1">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div {...dataUi('toolbar', { align: 'end' })}>
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
