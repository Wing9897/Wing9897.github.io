import { downloadFile, parseCsv, parseTsv, readXlsx, serializeTsv, type TableData } from '@/lib'

function matrixFromTable(table: TableData): string[][] {
  if (table.headers.length === 0) return []
  const width = Math.max(table.headers.length, ...table.rows.map((row) => row.length), 0)
  const fit = (row: string[]) => {
    const next = row.slice(0, width)
    while (next.length < width) next.push('')
    return next
  }
  return [fit(table.headers), ...table.rows.map(fit)]
}

export async function readTableFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return matrixFromTable(await readXlsx(file))
  const text = await file.text()
  return matrixFromTable(name.endsWith('.csv') ? parseCsv(text) : parseTsv(text))
}

export function downloadTable(rows: string[][], filename: string) {
  if (rows.length === 0) return
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const fit = (row: string[]) => {
    const next = row.slice()
    while (next.length < width) next.push('')
    return next
  }
  const [headers, ...body] = rows.map(fit)
  downloadFile(serializeTsv({ headers: headers ?? [], rows: body }), filename, 'text/tab-separated-values;charset=utf-8')
}

export function dateStamp() {
  return new Date().toISOString().slice(0, 10)
}
