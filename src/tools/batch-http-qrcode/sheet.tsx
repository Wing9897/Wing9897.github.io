import { useEffect, useId, useRef } from 'react'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { Field, Table, type TableColumn } from '@/components/ui'

export type SheetProps = {
  label: string
  rows: string[][]
  columnName: (column: number) => string
  placeholder: string
  activeRow?: number | null
  rowClassName?: (row: number) => string | undefined
  scrollRow?: number | null
  tabWrap?: boolean
  onRows: (rows: string[][]) => void
}

type CellPos = { row: number; col: number }
type RowModel = { index: number; cells: string[] }

function pasteGrid(rows: string[][], startRow: number, startCol: number, text: string): string[][] {
  const valid = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '')
  if (valid.length === 0) return rows

  const next = rows.map((row) => row.slice())
  const widthOf = () => next[0]?.length ?? 0

  for (let rowOffset = 0; rowOffset < valid.length; rowOffset += 1) {
    const cells = (valid[rowOffset] ?? '').split('\t')
    const currentRow = startRow + rowOffset
    while (next.length <= currentRow) {
      next.push(Array.from({ length: Math.max(widthOf(), 1) }, () => ''))
    }
    for (let colOffset = 0; colOffset < cells.length; colOffset += 1) {
      const currentCol = startCol + colOffset
      while (widthOf() <= currentCol) {
        for (const row of next) row.push('')
      }
      const row = next[currentRow]
      const value = cells[colOffset]
      if (row && value !== undefined) row[currentCol] = value.trim()
    }
  }
  return next
}

export function Sheet({
  label,
  rows,
  columnName,
  placeholder,
  activeRow = null,
  rowClassName,
  scrollRow = null,
  tabWrap = false,
  onRows,
}: SheetProps) {
  const baseId = useId()
  const selected = useRef<CellPos | null>(null)
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const pendingFocus = useRef<CellPos | null>(null)
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)

  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    const input = inputs.current.get(`${target.row}:${target.col}`)
    if (!input) return
    pendingFocus.current = null
    input.focus()
  }, [rows])

  useEffect(() => {
    if (scrollRow == null) return
    document.getElementById(`${baseId}-r${scrollRow}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [baseId, scrollRow])

  function focusAt(row: number, col: number) {
    const input = inputs.current.get(`${row}:${col}`)
    if (input) {
      pendingFocus.current = null
      input.focus()
      return
    }
    pendingFocus.current = { row, col }
  }

  function updateCell(row: number, col: number, value: string) {
    onRows(
      rows.map((cells, index) => {
        if (index !== row) return cells
        const copy = cells.slice()
        while (copy.length <= col) copy.push('')
        copy[col] = value
        return copy
      }),
    )
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const columnCount = rows[0]?.length ?? 0
    if (columnCount === 0) return

    if (event.key === 'Tab') {
      event.preventDefault()
      if (event.shiftKey) {
        if (col > 0) focusAt(row, col - 1)
        else if (tabWrap && row > 0) focusAt(row - 1, columnCount - 1)
        return
      }
      if (col < columnCount - 1) {
        focusAt(row, col + 1)
        return
      }
      onRows(rows.map((cells) => [...cells, '']))
      focusAt(row, columnCount)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (row < rows.length - 1) {
        focusAt(row + 1, col)
        return
      }
      onRows([...rows.map((cells) => cells.slice()), Array.from({ length: columnCount }, () => '')])
      focusAt(rows.length, col)
      return
    }

    if (event.key === 'ArrowUp' && row > 0) {
      event.preventDefault()
      focusAt(row - 1, col)
    } else if (event.key === 'ArrowDown' && row < rows.length - 1) {
      event.preventDefault()
      focusAt(row + 1, col)
    } else if (event.key === 'ArrowLeft' && col > 0) {
      event.preventDefault()
      focusAt(row, col - 1)
    } else if (event.key === 'ArrowRight' && col < columnCount - 1) {
      event.preventDefault()
      focusAt(row, col + 1)
    }
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const cell = selected.current
    if (!cell) return
    event.preventDefault()
    const next = pasteGrid(rows, cell.row, cell.col, event.clipboardData.getData('text'))
    if (next !== rows) onRows(next)
  }

  function bindInput(row: number, col: number) {
    return (node: HTMLDivElement | null) => {
      const key = `${row}:${col}`
      if (!node) {
        inputs.current.delete(key)
        return
      }
      const input = node.querySelector('input')
      if (input) inputs.current.set(key, input)
      else inputs.current.delete(key)
    }
  }

  if (width === 0) return <p className="batch-help">表格是空的</p>

  const model: RowModel[] = rows.map((cells, index) => ({ index, cells }))
  const columns: TableColumn<RowModel>[] = [
    {
      key: 'index',
      header: '#',
      width: '3.25rem',
      render: (row) => (
        <span id={`${baseId}-r${row.index}`} className={activeRow === row.index ? 'mark-current' : undefined}>
          {row.index + 1}
        </span>
      ),
    },
    ...Array.from({ length: width }, (_, col) => ({
      key: `c${col}`,
      header: columnName(col),
      render: (row: RowModel) => (
        <div ref={bindInput(row.index, col)}>
          <Field
            className={['sheet-field', rowClassName?.(row.index)].filter(Boolean).join(' ')}
            label={`${columnName(col)}，第 ${row.index + 1} 列`}
            hideLabel
            value={row.cells[col] ?? ''}
            placeholder={placeholder}
            autoComplete="off"
            onFocus={(event) => {
              selected.current = { row: row.index, col }
              event.currentTarget.select()
            }}
            onChange={(event) => updateCell(row.index, col, event.target.value)}
            onKeyDown={(event) => onKey(event, row.index, col)}
          />
        </div>
      ),
    })),
  ]

  return (
    <div className="http-sheet" onPaste={onPaste}>
      <Table label={label} columns={columns} rows={model} getRowKey={(row) => String(row.index)} />
    </div>
  )
}
