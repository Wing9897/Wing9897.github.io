import type { ButtonHTMLAttributes } from 'react'
import { buttonBase, buttonVariants, classes, type ButtonVariant } from './classes'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  active?: boolean
}

export function Button({ variant = 'primary', active, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(buttonBase, buttonVariants[variant], className)}
      aria-pressed={active === undefined ? undefined : active}
      {...rest}
    />
  )
}
