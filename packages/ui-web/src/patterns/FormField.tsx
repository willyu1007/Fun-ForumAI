/**
 * FormField - Form field wrapper with label, control, help, and error slots
 * 
 * Uses data-ui="field" for semantic styling.
 */

import * as React from 'react'
import { dataUi, dataSlot } from '../data-ui.js'

export interface FormFieldProps {
  label: React.ReactNode
  htmlFor?: string
  help?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  htmlFor,
  help,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  const state = error ? 'error' : 'default'

  return (
    <div {...dataUi('field', { state })} className={className}>
      <label {...dataSlot('label')} htmlFor={htmlFor} className="block mb-1">
        <span {...dataUi('text', { variant: 'label' })}>
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
      </label>
      <div {...dataSlot('control')}>
        {children}
      </div>
      {help && !error && (
        <p {...dataSlot('help')} className="mt-1">
          <span {...dataUi('text', { variant: 'caption', tone: 'muted' })}>
            {help}
          </span>
        </p>
      )}
      {error && (
        <p {...dataSlot('error')} className="mt-1">
          <span {...dataUi('text', { variant: 'caption', tone: 'danger' })}>
            {error}
          </span>
        </p>
      )}
    </div>
  )
}
