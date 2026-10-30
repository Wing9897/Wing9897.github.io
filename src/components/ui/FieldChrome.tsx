import type { ReactNode } from 'react'
import { classes, fieldLayout, hintClass, hintIdFor, labelClass } from './classes'

type FieldChromeProps = {
  id: string
  label: string
  hint?: string
  hideLabel?: boolean
  className?: string
  children: ReactNode
}

export function FieldChrome({ id, label, hint, hideLabel = false, className, children }: FieldChromeProps) {
  return (
    <label className={classes(fieldLayout, className)} htmlFor={id}>
      <span className={classes(labelClass, hideLabel && 'sr-only')}>{label}</span>
      {children}
      {hint ? (
        <span className={hintClass} id={hintIdFor(id, hint)}>
          {hint}
        </span>
      ) : null}
    </label>
  )
}
