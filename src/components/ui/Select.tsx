import { useId, type SelectHTMLAttributes } from 'react'
import { classes, hintIdFor, nativeControlClass } from './classes'
import { FieldChrome } from './FieldChrome'

export interface SelectOption {
  value: string
  label: string
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hideLabel?: boolean
  hint?: string
  options: SelectOption[]
}

export function Select({ label, hideLabel = false, hint, options, id, className, ...rest }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <FieldChrome id={selectId} label={label} hint={hint} hideLabel={hideLabel} className={classes('ui-field', className)}>
      <select id={selectId} className={nativeControlClass} aria-describedby={hintIdFor(selectId, hint)} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldChrome>
  )
}
