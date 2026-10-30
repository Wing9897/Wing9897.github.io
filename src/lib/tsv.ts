export type TableData = {
  headers: string[]
  rows: string[][]
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function tableFromRecords(records: string[][]): TableData {
  const [headers, ...rows] = records
  if (!headers) return { headers: [], rows: [] }
  return { headers, rows }
}

export function parseTsv(text: string): TableData {
  const source = stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (source.trim() === '') return { headers: [], rows: [] }
  const lines = source.split('\n')
  if (lines.at(-1) === '') lines.pop()
  const records = lines.filter((line) => line.length > 0).map((line) => line.split('\t'))
  return tableFromRecords(records)
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  const endRow = () => {
    row.push(field)
    field = ''
    records.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch ?? ''
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      endRow()
      continue
    }
    field += ch ?? ''
  }

  if (field.length > 0 || row.length > 0) endRow()

  while (records.length > 0) {
    const last = records[records.length - 1]
    if (last?.length === 1 && last[0] === '') records.pop()
    else break
  }
  return records
}

export function parseCsv(text: string): TableData {
  const source = stripBom(text)
  if (source.trim() === '') return { headers: [], rows: [] }
  return tableFromRecords(parseCsvRecords(source))
}

export function serializeTsv(table: TableData): string {
  if (table.headers.length === 0 && table.rows.length === 0) return ''
  return [table.headers, ...table.rows].map((row) => row.join('\t')).join('\n')
}
