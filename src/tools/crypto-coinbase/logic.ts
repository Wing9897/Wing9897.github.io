import { downloadFile, exportDatabaseBlob, loadSqlJs, writeXlsx } from '@/lib'

export const INTERVALS = [
  { value: '60', label: '1分鐘' },
  { value: '300', label: '5分鐘' },
  { value: '900', label: '15分鐘' },
  { value: '3600', label: '1小時' },
  { value: '21600', label: '6小時' },
  { value: '86400', label: '1天' },
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

export async function fetchCoinbaseData(
  symbol: string,
  granularity: string,
  startDate: string,
  endDate: string,
  log: LogFn,
  isActive: () => boolean = () => true,
): Promise<CandleFetch> {
  try {
    const allData: unknown[][] = []
    const maxCandles = 300
    const secondsPerCandle = Number.parseInt(granularity, 10)
    const batchSeconds = maxCandles * secondsPerCandle
    let currentStart = new Date(startDate)
    const finalEnd = new Date(endDate)
    log(`📡 正在從 Coinbase 獲取 ${symbol} 數據...`)
    let batchCount = 0
    while (currentStart < finalEnd && isActive()) {
      const currentEnd = new Date(Math.min(currentStart.getTime() + batchSeconds * 1000, finalEnd.getTime()))
      const url = `https://api.exchange.coinbase.com/products/${symbol}/candles`
      const params = new URLSearchParams({
        start: currentStart.toISOString(),
        end: currentEnd.toISOString(),
        granularity,
      })
      batchCount += 1
      log(`  批次 ${batchCount}: ${currentStart.toISOString().split('T')[0]} ~ ${currentEnd.toISOString().split('T')[0]}`)
      const response = await fetch(`${url}?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      const candles: unknown = await response.json()
      if (Array.isArray(candles) && candles.length > 0) {
        for (const candle of candles) {
          if (Array.isArray(candle)) allData.push(candle)
        }
        log(`  ✓ 獲取 ${candles.length} 條數據`, 'success')
      }
      currentStart = currentEnd
      await sleep(500)
    }
    if (allData.length === 0) {
      return { success: false, records: 0, message: '無數據返回', data: null }
    }
    const data = allData.map((kline) => ({
      Symbol: symbol,
      Time: new Date(Number(kline[0]) * 1000).toISOString().replace('T', ' ').substring(0, 19),
      Open: Number.parseFloat(String(kline[3])),
      High: Number.parseFloat(String(kline[2])),
      Low: Number.parseFloat(String(kline[1])),
      Close: Number.parseFloat(String(kline[4])),
      Volume: Number.parseFloat(String(kline[5])),
    }))
    data.sort((a, b) => (a.Time < b.Time ? -1 : a.Time > b.Time ? 1 : 0))
    log(`✅ 成功獲取 ${symbol} ${data.length} 筆數據`, 'success')
    return {
      success: true,
      records: data.length,
      message: `成功獲取 ${data.length} 筆數據 (${batchCount} 批次)`,
      data,
    }
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
