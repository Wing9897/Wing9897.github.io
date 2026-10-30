export function classes(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export const fieldLayout = 'flex min-w-0 max-w-full flex-col gap-1'
export const labelClass = 'text-sm font-medium'
export const hintClass = 'm-0 text-xs leading-normal text-text-muted'
export const stackClass = 'flex flex-col gap-4'

export const controlClass =
  'ui-control flex min-h-control min-w-0 max-w-full items-center gap-2 rounded-md border border-solid border-border bg-surface px-3 focus-within:border-focus focus-within:shadow-focus'

export const controlInputClass =
  'min-h-[calc(var(--control-h)-2px)] w-full min-w-0 border-0 bg-transparent p-0 text-md outline-none focus:outline-none'

export const nativeControlClass =
  'min-h-control w-full min-w-0 max-w-full rounded-md border border-solid border-border bg-surface px-3 py-2 text-md outline-none focus:border-focus focus:shadow-focus focus:outline-none'

export const iconClass = 'inline-flex text-text-muted'

const pressed =
  'aria-pressed:!bg-accent-soft aria-pressed:font-semibold aria-pressed:!text-accent-strong aria-pressed:hover:!bg-accent-soft'

export const buttonBase =
  'ui-btn inline-flex cursor-pointer items-center justify-center gap-2 border border-solid font-medium leading-tight disabled:cursor-not-allowed disabled:opacity-45'

export const buttonVariants = {
  primary: `min-h-control rounded-sm border-transparent bg-accent px-3 text-sm text-accent-text ${pressed}`,
  ghost: `min-h-control rounded-sm border-transparent bg-transparent px-3 text-sm text-text hover:bg-row-hover ${pressed}`,
  danger: `min-h-control rounded-sm border-transparent bg-danger px-3 text-sm text-on-danger ${pressed}`,
  nav: `min-h-10 w-full justify-between rounded-md border-transparent bg-transparent px-3 text-left text-md text-text hover:bg-row-hover ${pressed} aria-pressed:shadow-[inset_3px_0_0_var(--color-accent)]`,
  chip: 'min-h-11 shrink-0 whitespace-nowrap rounded-full border-border bg-surface px-3.5 text-sm text-text hover:bg-surface-2 aria-pressed:!border-transparent aria-pressed:!bg-accent aria-pressed:!text-accent-text aria-pressed:!shadow-none aria-pressed:hover:!bg-accent',
} as const

export type ButtonVariant = keyof typeof buttonVariants

export function hintIdFor(id: string, hint?: string): string | undefined {
  return hint ? `${id}-hint` : undefined
}
