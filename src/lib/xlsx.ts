import * as XLSX from 'xlsx'
import type { TableData } from './tsv'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function cellToString(cell: unknown): string {
  if (cell == null) return ''
  if (typeof cell === 'string') return cell
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell)
  if (cell instanceof Date) return cell.toISOString()
  return ''
}

function toTable(matrix: string[][]): TableData {
  const width = matrix.reduce((max, row) => Math.max(max, row.length), 0)
  if (matrix.length === 0 || width === 0) return { headers: [], rows: [] }
  const fit = (row: string[]) => {
    const next = row.slice(0, width)
    while (next.length < width) next.push('')
    return next
  }
  const [headerRow, ...body] = matrix
  return { headers: fit(headerRow ?? []), rows: body.map(fit) }
}

function xlsxBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (Array.isArray(data)) {
    const bytes = new Uint8Array(data.length)
    for (let i = 0; i < data.length; i += 1) {
      const value = data[i]
      if (typeof value !== 'number') throw new Error('無法寫出 xlsx')
      bytes[i] = value
    }
    return bytes
  }
  throw new Error('無法寫出 xlsx')
}

async function toArrayBuffer(input: ArrayBuffer | File): Promise<ArrayBuffer> {
  if (input instanceof File) return input.arrayBuffer()
  return input
}

export async function readXlsx(input: ArrayBuffer | File): Promise<TableData> {
  const buffer = await toArrayBuffer(input)
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return { headers: [], rows: [] }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  })
  const matrix = rows.map((row) => (Array.isArray(row) ? row.map(cellToString) : []))
  return toTable(matrix)
}

export function writeXlsx(table: TableData): Blob {
  const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
  const written: unknown = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const bytes = xlsxBytes(written)
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new Blob([copy], { type: XLSX_MIME })
}
