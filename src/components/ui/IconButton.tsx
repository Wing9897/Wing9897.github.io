import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { classes } from './classes'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  children: ReactNode
}

export function IconButton({ label, className, type = 'button', children, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={classes(
        'ui-icon-btn inline-flex size-control shrink-0 cursor-pointer items-center justify-center rounded-sm border border-solid border-transparent bg-transparent hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  )
}
