import { useId, type ChangeEvent } from 'react'
import { classes, hintIdFor, nativeControlClass } from './classes'
import { FieldChrome } from './FieldChrome'

type FileInputProps = {
  label: string
  accept?: string
  hint?: string
  className?: string
  onFiles: (files: FileList) => void
}

export function FileInput({ label, accept, hint, className, onFiles }: FileInputProps) {
  const inputId = useId()

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (files && files.length > 0) onFiles(files)
    event.target.value = ''
  }

  return (
    <FieldChrome id={inputId} label={label} hint={hint} className={classes('ui-file', className)}>
      <input
        id={inputId}
        className={nativeControlClass}
        type="file"
        accept={accept}
        aria-describedby={hintIdFor(inputId, hint)}
        onChange={onChange}
      />
    </FieldChrome>
  )
}
