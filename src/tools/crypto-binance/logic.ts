import { downloadFile, exportDatabaseBlob, loadSqlJs, writeXlsx } from '@/lib'

export const INTERVALS = [
  { value: '1m', label: '1分鐘' },
  { value: '3m', label: '3分鐘' },
  { value: '5m', label: '5分鐘' },
  { value: '15m', label: '15分鐘' },
  { value: '30m', label: '30分鐘' },
  { value: '1h', label: '1小時' },
  { value: '2h', label: '2小時' },
  { value: '4h', label: '4小時' },
  { value: '6h', label: '6小時' },
  { value: '8h', label: '8小時' },
  { value: '12h', label: '12小時' },
  { value: '1d', label: '1天' },
  { value: '3d', label: '3天' },
  { value: '1w', label: '1週' },
  { value: '1M', label: '1月' },
] as const

export const FORMATS = [
  { value: 'CSV', label: 'CSV' },
  { value: 'Excel', label: 'Excel' },
  { value: 'SQLite', label: 'SQLite' },
  { value: 'JSON', label: 'JSON' },
] as const

export type OutputFormat = (typeof FORMATS)[number]['value']
export type LogType = 'info' | 'success' | 'error' | 'warning'
export type LogFn = (message: string, type?: LogType) => void

export type CandleRow = {
  Symbol: string
  Time: string
  Open: number
  High: number
  Low: number
  Close: number
  Volume: number
}

export type CandleFetch = {
  success: boolean
  records: number
  message: string
  data: CandleRow[] | null
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function dateInputValue(date: Date): string {
  return date.toISOString().split('T')[0] ?? ''
}

export function initialMonthRange(): { start: string; end: string } {
  const today = new Date()
  const oneMonthAgo = new Date(today)
  oneMonthAgo.setMonth(today.getMonth() - 1)
  return { start: dateInputValue(oneMonthAgo), end: dateInputValue(today) }
}

export function parseSymbols(symbolsText: string): string[] {
  return symbolsText
    .split(/[,\n\r]+/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item.length > 0)
}

export function isOutputFormat(value: string): value is OutputFormat {
  return FORMATS.some((item) => item.value === value)
}

function stamp(value: unknown): string {
  return new Date(Number(value)).toISOString().replace('T', ' ').substring(0, 19)
}

export async function fetchBinanceData(
  symbol: string,
  interval: string,
  startDate: string,
  endDate: string,
  log: LogFn,
): Promise<CandleFetch> {
  try {
    const startTime = new Date(startDate).getTime()
    const endTime = new Date(endDate).getTime()
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`
    log(`📡 正在從 Binance 獲取 ${symbol} 數據...`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    const klines: unknown = await response.json()
    if (!klines || (Array.isArray(klines) && klines.length === 0)) {
      return { success: false, records: 0, message: '無數據返回', data: null }
    }
    if (!Array.isArray(klines)) throw new Error('無數據返回')
    const data = klines.map((kline) => {
      if (!Array.isArray(kline)) throw new Error('無數據返回')
      return {
        Symbol: symbol,
        Time: stamp(kline[0]),
        Open: Number.parseFloat(String(kline[1])),
        High: Number.parseFloat(String(kline[2])),
        Low: Number.parseFloat(String(kline[3])),
        Close: Number.parseFloat(String(kline[4])),
        Volume: Number.parseFloat(String(kline[5])),
      }
    })
    log(`✅ 成功獲取 ${symbol} ${data.length} 筆數據`, 'success')
    return { success: true, records: data.length, message: `成功獲取 ${data.length} 筆數據`, data }
  } catch (error) {
    const message = errorMessage(error)
    log(`❌ ${symbol} 獲取失敗: ${message}`, 'error')
    return { success: false, records: 0, message, data: null }
  }
}

export function convertToCSV(data: ReadonlyArray<Record<string, string | number>>): string {
  const first = data[0]
  if (!first) return ''
  const headers = Object.keys(first)
  return [headers.join(','), ...data.map((row) => headers.map((header) => `"${row[header] ?? ''}"`).join(','))].join('\n')
}

async function convertToSQLite(data: CandleRow[], tableName: string): Promise<Blob> {
  const SQL = await loadSqlJs()
  const db = new SQL.Database()
  try {
    const safeName = tableName.replace(/[^a-zA-Z0-9_]/g, '_')
    db.run(`CREATE TABLE crypto_${safeName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      time TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL
    )`)
    db.run('BEGIN TRANSACTION')
    for (const row of data) {
      db.run(
        `INSERT INTO crypto_${safeName} (symbol, time, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.Symbol, row.Time, row.Open, row.High, row.Low, row.Close, row.Volume],
      )
    }
    db.run('COMMIT')
    return exportDatabaseBlob(db)
  } catch (error) {
    console.error('SQLite生成失敗:', error)
    throw error
  } finally {
    db.close()
  }
}

export async function downloadCandleFile(data: CandleRow[], filename: string, format: OutputFormat): Promise<void> {
  if (format === 'JSON') {
    downloadFile(`\uFEFF${JSON.stringify(data, null, 2)}`, `${filename}.json`, 'application/json;charset=utf-8')
    return
  }
  if (format === 'SQLite') {
    downloadFile(await convertToSQLite(data, filename), `${filename}.db`)
    return
  }
  if (format === 'Excel') {
    downloadFile(
      writeXlsx({
        headers: ['交易對', '時間', '開盤價', '最高價', '最低價', '收盤價', '成交量'],
        rows: data.map((row) => [
          row.Symbol,
          row.Time,
          String(row.Open),
          String(row.High),
          String(row.Low),
          String(row.Close),
          String(row.Volume),
        ]),
      }),
      `${filename}.xlsx`,
    )
    return
  }
  downloadFile(`\uFEFF${convertToCSV(data)}`, `${filename}.csv`, 'text/csv;charset=utf-8')
}
