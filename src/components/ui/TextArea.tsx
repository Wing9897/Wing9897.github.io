import { useId, type TextareaHTMLAttributes } from 'react'
import { classes, hintIdFor, nativeControlClass } from './classes'
import { FieldChrome } from './FieldChrome'

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: string
}

export function TextArea({ label, hint, id, className, ...rest }: TextAreaProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <FieldChrome id={inputId} label={label} hint={hint} className={classes('ui-field', className)}>
      <textarea
        id={inputId}
        className={classes('ui-textarea resize-y leading-normal', nativeControlClass)}
        aria-describedby={hintIdFor(inputId, hint)}
        {...rest}
      />
    </FieldChrome>
  )
}
