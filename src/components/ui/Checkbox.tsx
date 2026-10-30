import { useId, type InputHTMLAttributes } from 'react'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
}

export function Checkbox({ label, id, ...rest }: CheckboxProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label className="flex min-h-control cursor-pointer items-center gap-2 text-sm" htmlFor={inputId}>
      <input id={inputId} className="size-4 accent-accent" type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  )
}
