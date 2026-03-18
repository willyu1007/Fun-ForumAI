/**
 * InlineAlert - Inline alert/notification
 * 
 * Uses data-ui="alert" for semantic styling.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui.js'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

export interface InlineAlertProps {
  title?: React.ReactNode
  children: React.ReactNode
  tone?: AlertTone
  variant?: 'subtle' | 'solid'
  actions?: React.ReactNode
  onDismiss?: () => void
  className?: string
}

export function InlineAlert({
  title,
  children,
  tone = 'info',
  variant = 'subtle',
  actions,
  onDismiss,
  className,
}: InlineAlertProps) {
  return (
    <div
      {...dataUi('alert', { tone, variant })}
      role="alert"
      className={className}
    >
      <div className="flex-1">
        {title && (
          <div {...dataSlot('title')}>
            <strong {...dataUi('text', { variant: 'label' })}>{title}</strong>
          </div>
        )}
        <div {...dataSlot('body')}>
          {children}
        </div>
      </div>
      {(actions || onDismiss) && (
        <div {...dataSlot('actions')} className="flex items-center gap-2 ml-4">
          {actions}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              {...dataUi('icon-button', { variant: 'ghost', size: 'sm' })}
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  )
}
