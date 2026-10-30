import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { classes, controlClass, controlInputClass, hintIdFor, iconClass } from './classes'
import { FieldChrome } from './FieldChrome'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  hideLabel?: boolean
  icon?: ReactNode
  trailing?: ReactNode
}

export function Field({ label, hint, hideLabel = false, icon, trailing, id, className, ...rest }: FieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <FieldChrome id={inputId} label={label} hint={hint} hideLabel={hideLabel} className={classes('ui-field', className)}>
      <span className={controlClass}>
        {icon ? <span className={iconClass}>{icon}</span> : null}
        <input id={inputId} className={controlInputClass} aria-describedby={hintIdFor(inputId, hint)} {...rest} />
        {trailing}
      </span>
    </FieldChrome>
  )
}
