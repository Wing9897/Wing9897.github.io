import { useId, useState, type ReactNode } from 'react'
import { classes } from './classes'

export interface TabItem {
  id: string
  label: string
  content: ReactNode
}

type TabsProps = {
  label: string
  tabs: TabItem[]
  value?: string
  defaultValue?: string
  onChange?: (id: string) => void
}

export function Tabs({ label, tabs, value, defaultValue, onChange }: TabsProps) {
  const baseId = useId()
  const first = tabs[0]?.id ?? ''
  const [internal, setInternal] = useState(defaultValue ?? first)
  const selected = value ?? internal

  function select(id: string) {
    if (value === undefined) setInternal(id)
    onChange?.(id)
  }

  function move(current: string, direction: 1 | -1) {
    const index = tabs.findIndex((tab) => tab.id === current)
    if (index < 0 || tabs.length === 0) return
    const next = tabs[(index + direction + tabs.length) % tabs.length]
    if (next) select(next.id)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex gap-1 overflow-x-auto border-b border-solid border-border" role="tablist" aria-label={label}>
        {tabs.map((tab) => {
          const active = tab.id === selected
          return (
            <button
              key={tab.id}
              type="button"
              className={classes(
                'min-h-control shrink-0 cursor-pointer whitespace-nowrap rounded-t-sm border border-solid border-transparent bg-transparent px-3',
                active
                  ? 'font-semibold text-accent-strong shadow-[inset_0_-2px_0_var(--color-accent)]'
                  : 'text-text-muted',
              )}
              role="tab"
              id={`${baseId}-${tab.id}-tab`}
              aria-selected={active}
              aria-controls={`${baseId}-${tab.id}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => select(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  move(tab.id, 1)
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault()
                  move(tab.id, -1)
                }
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {tabs.map((tab) => {
        const active = tab.id === selected
        return (
          <div
            key={tab.id}
            className="min-w-0"
            role="tabpanel"
            id={`${baseId}-${tab.id}-panel`}
            aria-labelledby={`${baseId}-${tab.id}-tab`}
            hidden={!active}
          >
            {active ? tab.content : null}
          </div>
        )
      })}
    </div>
  )
}
