import type { KeyboardEvent, ReactNode } from 'react'
import { classes } from './classes'

export interface TableColumn<T> {
  key: string
  header: string
  width?: string
  render: (row: T) => ReactNode
}

type TableProps<T> = {
  label: string
  columns: TableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
}

const cell =
  'mt-0.5 block overflow-hidden border-b-0 p-0 align-middle whitespace-normal first:mt-0 md:table-cell md:mt-0 md:overflow-hidden md:text-ellipsis md:whitespace-nowrap'

export function Table<T>({ label, columns, rows, getRowKey, onRowClick }: TableProps<T>) {
  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick) return
    if (event.key === 'Enter') {
      event.preventDefault()
      onRowClick(row)
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="ui-table w-full border-collapse table-auto text-sm md:table-fixed">
        <caption className="sr-only">{label}</caption>
        <thead className="hidden md:table-header-group">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="border-b border-solid border-border px-3 py-2 text-left text-xs font-semibold text-text-muted"
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className={classes(
                'block min-h-11 border-b border-solid border-border p-3 md:table-row md:min-h-0 md:border-b-0 md:p-0',
                onRowClick && 'cursor-pointer hover:bg-row-hover',
              )}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={
                onRowClick
                  ? (event) => {
                      const target = event.target as HTMLElement
                      if (target.closest('a, button, input, label, select, textarea')) return
                      onRowClick(row)
                    }
                  : undefined
              }
              onKeyDown={onRowClick ? (event) => onKeyDown(event, row) : undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={classes(cell, 'md:border-b md:border-solid md:border-border md:px-3 md:py-[9px]')}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
