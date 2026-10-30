import { classes, fieldLayout, labelClass } from './classes'

export interface SegmentedOption {
  value: string
  label: string
}

type SegmentedProps = {
  label: string
  hideLabel?: boolean
  value: string
  options: SegmentedOption[]
  onChange: (value: string) => void
}

export function Segmented({ label, hideLabel = false, value, options, onChange }: SegmentedProps) {
  return (
    <div className={fieldLayout}>
      <span className={hideLabel ? 'sr-only' : labelClass}>{label}</span>
      <div
        className="ui-segmented inline-flex max-w-full rounded-md border border-solid border-border bg-surface-2 p-0.5"
        role="radiogroup"
        aria-label={label}
      >
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              className={classes(
                'min-h-[calc(var(--control-h)-6px)] cursor-pointer rounded-[calc(var(--radius-md)-2px)] border border-solid border-transparent px-3 text-sm',
                selected ? 'bg-surface font-semibold text-accent-strong' : 'bg-transparent',
              )}
              aria-checked={selected}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
