/**
 * EmptyState - Empty state display for lists and content areas
 * 
 * Uses data-ui="empty-state".
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  variant?: 'default' | 'compact'
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  variant = 'default',
  className,
}: EmptyStateProps) {
  return (
    <div
      {...dataUi('empty-state', { variant, tone: 'neutral' })}
      className={className}
    >
      {icon && (
        <div {...dataSlot('icon')} className="mb-4">
          {icon}
        </div>
      )}
      <div {...dataSlot('title')}>
        <h3 {...dataUi('text', { variant: 'h3' })}>{title}</h3>
      </div>
      {description && (
        <div {...dataSlot('body')} className="mt-2">
          <p {...dataUi('text', { variant: 'body', tone: 'secondary' })}>
            {description}
          </p>
        </div>
      )}
      {actions && (
        <div {...dataSlot('actions')} className="mt-4">
          {actions}
        </div>
      )}
    </div>
  )
}
