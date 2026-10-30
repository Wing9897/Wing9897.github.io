import type { ReactNode } from 'react'
import { classes } from './classes'

type BannerTone = 'info' | 'warning' | 'danger' | 'success'

type BannerProps = {
  tone?: BannerTone
  title?: string
  children: ReactNode
}

const tones: Record<BannerTone, string> = {
  info: 'bg-info-bg text-info',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  success: 'bg-success-bg text-success',
}

export function Banner({ tone = 'info', title, children }: BannerProps) {
  return (
    <div
      className={classes('rounded-md border border-solid border-border px-4 py-3 text-sm leading-normal', tones[tone])}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {title ? <strong className="mb-1 block">{title}</strong> : null}
      <div>{children}</div>
    </div>
  )
}
