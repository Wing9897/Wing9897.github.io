import { downloadFile, exportDatabaseBlob, loadSqlJs, writeXlsx } from '@/lib'

export const MARKETS = [
  { value: '美國', suffix: '', label: '美國 (USD)', examples: 'AAPL, MSFT, GOOGL' },
  { value: '台灣', suffix: '.TW', label: '台灣 (TWD)', examples: '2330.TW, 2317.TW' },
  { value: '香港', suffix: '.HK', label: '香港 (HKD)', examples: '0700.HK, 0005.HK' },
  { value: '日本', suffix: '.T', label: '日本 (JPY)', examples: '7203.T, 6758.T' },
  { value: '德國', suffix: '.DE', label: '德國 (EUR)', examples: 'SAP.DE, VOW3.DE' },
  { value: '英國', suffix: '.L', label: '英國 (GBP)', examples: 'BARC.L, LLOY.L' },
] as const

export const INTERVALS = [
  { value: '1m', label: '1分鐘' },
  { value: '2m', label: '2分鐘' },
  { value: '5m', label: '5分鐘' },
  { value: '15m', label: '15分鐘' },
  { value: '30m', label: '30分鐘' },
  { value: '60m', label: '60分鐘' },
  { value: '1h', label: '1小時' },
  { value: '1d', label: '1天' },
  { value: '1wk', label: '1週' },
  { value: '1mo', label: '1月' },
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

export type StockRow = {
  Symbol: string
  Date: string
  Open: number
  High: number
  Low: number
  Close: number
  Volume: number
}

export type StockFetch = {
  success: boolean
  records: number
  message: string
  data: StockRow[] | null
}

export type SymbolStatus = {
  tone: 'muted' | 'ok' | 'warn' | 'bad'
  text: string
}

const SETTINGS_KEY = 'stockDownloaderSettings'
const SUFFIXES = ['.TW', '.HK', '.T', '.DE', '.L']
const INTRADAY = new Set(['1m', '2m', '5m', '15m', '30m', '60m', '1h'])
const SYMBOL_PATTERN = /^[A-Z0-9]+(\.[A-Z]{1,3})?$/

const INTERVAL_WARNINGS: Record<string, string> = {
  '1m': '1分鐘數據：僅限最近7天',
  '2m': '2分鐘數據：範圍最多59天，且須在最近60天內',
  '5m': '5分鐘數據：範圍最多59天，且須在最近60天內',
  '15m': '15分鐘數據：範圍最多59天，且須在最近60天內',
  '30m': '30分鐘數據：範圍最多59天，且須在最近60天內',
  '60m': '60分鐘數據：僅限最近730天(約2年)',
  '1h': '1小時數據：僅限最近730天(約2年)',
  '1d': '日線數據：可獲取長期歷史數據',
  '1wk': '週線數據：可獲取長期歷史數據',
  '1mo': '月線數據：可獲取長期歷史數據',
}

type YahooQuote = {
  open?: Array<number | null>
  high?: Array<number | null>
  low?: Array<number | null>
  close?: Array<number | null>
  volume?: Array<number | null>
}

type YahooResult = {
  timestamp?: number[]
  indicators?: { quote?: YahooQuote[] }
  meta?: {
    exchangeName?: string
    currency?: string
    tradingPeriods?: unknown[]
  }
}

type YahooResponse = {
  chart?: {
    error?: { description?: string; code?: string }
    result?: YahooResult[]
  }
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

export function initialStockDates(): { start: string; end: string } {
  const today = new Date()
  const oneYearAgo = new Date(today)
  oneYearAgo.setFullYear(today.getFullYear() - 1)
  return { start: dateInputValue(oneYearAgo), end: dateInputValue(today) }
}

export function loadStockSettings(): { market: string; interval: string; outputFormat: OutputFormat } {
  const defaults = { market: '美國', interval: '1d', outputFormat: 'CSV' as OutputFormat }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaults
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaults
    const record = parsed as Record<string, unknown>
    const market =
      typeof record.market === 'string' && MARKETS.some((item) => item.value === record.market)
        ? record.market
        : defaults.market
    const interval =
      typeof record.interval === 'string' && INTERVALS.some((item) => item.value === record.interval)
        ? record.interval
        : defaults.interval
    const outputFormat =
      typeof record.outputFormat === 'string' && FORMATS.some((item) => item.value === record.outputFormat)
        ? (record.outputFormat as OutputFormat)
        : defaults.outputFormat
    return { market, interval, outputFormat }
  } catch {
    return defaults
  }
}

export function saveStockSettings(settings: {
  market: string
  interval: string
  outputFormat: OutputFormat
  startDate: string
  endDate: string
}): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function marketByValue(value: string): (typeof MARKETS)[number] {
  return MARKETS.find((item) => item.value === value) ?? MARKETS[0]
}

export function intervalWarning(interval: string): { tone: 'warning' | 'info'; text: string } {
  return {
    tone: INTRADAY.has(interval) ? 'warning' : 'info',
    text: INTERVAL_WARNINGS[interval] ?? '提醒: 請注意數據時間限制',
  }
}

export function describeSymbols(symbolsText: string): SymbolStatus {
  const symbols = symbolsText.trim()
  if (!symbols) return { tone: 'muted', text: '準備輸入股票代號' }
  const symbolList = symbols
    .split(/[,\n\r]+/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item.length > 0)
  if (symbolList.length === 0) return { tone: 'warn', text: '請輸入有效的股票代號' }
  const invalid = symbolList.filter((symbol) => !SYMBOL_PATTERN.test(symbol))
  if (invalid.length > 0) {
    const shown = invalid.slice(0, 3).join(', ')
    return { tone: 'bad', text: `無效代號: ${shown}${invalid.length > 3 ? '...' : ''}` }
  }
  if (symbolList.includes('APPL')) {
    return {
      tone: 'warn',
      text: `已識別 ${symbolList.length} 個股票代號。您輸入的是 APPL，是否要輸入 AAPL（蘋果公司）？`,
    }
  }
  return { tone: 'ok', text: `已識別 ${symbolList.length} 個股票代號` }
}

export function validateDateRange(startValue: string, endValue: string, interval: string): string | null {
  if (!startValue || !endValue) return null
  const startDate = new Date(startValue)
  const endDate = new Date(endValue)
  const today = new Date()
  if (startDate > endDate) return '開始日期不能晚於結束日期'
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
  const todayStr = dateInputValue(today)
  if (endDate > todayEnd) return `結束日期不能是未來日期！今天是 ${todayStr}`
  if (startDate > todayEnd) return `開始日期不能是未來日期！今天是 ${todayStr}`
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const limits: Record<string, number> = {
    '1m': 7,
    '2m': 59,
    '5m': 59,
    '15m': 59,
    '30m': 59,
    '60m': 729,
    '1h': 729,
  }
  const limit = limits[interval]
  if (limit && daysDiff > limit) {
    return `${interval} 間隔最多只能下載 ${limit} 天的數據，您選擇了 ${daysDiff} 天`
  }
  if (['2m', '5m', '15m', '30m'].includes(interval)) {
    const daysFromToday = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysFromToday > 60) {
      return `${interval} 間隔只能獲取最近60天內的數據，您的開始日期距今 ${daysFromToday} 天`
    }
  }
  return null
}

export function validateStockForm(symbolsText: string, start: string, end: string, interval: string): string[] {
  const errors: string[] = []
  if (!symbolsText.trim()) errors.push('請輸入至少一個股票代號')
  const dateError = validateDateRange(start, end, interval)
  if (dateError) errors.push(dateError)
  const symbolList = symbolsText
    .split(/[,\n\r]+/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item.length > 0)
  const invalid = symbolList.filter((symbol) => !SYMBOL_PATTERN.test(symbol))
  if (invalid.length > 0) {
    errors.push(`無效的股票代號: ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '...' : ''}`)
  }
  return errors
}

export function parseSymbols(symbolsText: string, marketSuffix: string): string[] {
  return symbolsText
    .split(/[,\n\r]+/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item.length > 0)
    .map((symbol) => {
      const hasSuffix = SUFFIXES.some((suffix) => symbol.endsWith(suffix))
      if (marketSuffix && !hasSuffix) return symbol + marketSuffix
      return symbol
    })
}

function validateStockSymbol(symbol: string): boolean {
  return /^[A-Z0-9]{1,10}(\.[A-Z]{1,3})?$/.test(symbol.toUpperCase())
}

function validateYfinanceLimits(
  startDate: string,
  endDate: string,
  interval: string,
): { valid: true } | { valid: false; message: string } {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const today = new Date()
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  switch (interval) {
    case '1m': {
      const daysFromToday = Math.ceil((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays > 7) return { valid: false, message: '1分鐘數據最多只能下載7天範圍' }
      if (daysFromToday > 30) return { valid: false, message: '1分鐘數據只能獲取最近30天內的數據' }
      break
    }
    case '2m':
    case '5m':
    case '15m':
    case '30m': {
      if (diffDays > 59) {
        return { valid: false, message: `${interval}數據最多只能下載59天範圍（Yahoo Finance限制）` }
      }
      const daysFromStart = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      if (daysFromStart > 60) {
        return {
          valid: false,
          message: `${interval}數據只能獲取最近60天內的數據，開始日期距今${daysFromStart}天`,
        }
      }
      break
    }
    case '60m':
    case '1h':
      if (diffDays > 729) return { valid: false, message: '小時數據最多只能下載729天範圍（Yahoo Finance限制）' }
      break
    default:
      break
  }
  return { valid: true }
}

function proxyUrl(symbol: string, period1: number, period2: number, interval: string, includePrePost: boolean): string {
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=${interval}&includePrePost=${includePrePost}&events=div%2Csplit`
  return `https://corsproxy.io/?${encodeURIComponent(target)}`
}

function asYahoo(value: unknown): YahooResponse {
  if (typeof value !== 'object' || value === null) {
    throw new Error('API響應格式錯誤：缺少chart節點')
  }
  return value as YahooResponse
}

function parseYahooFinanceResponse(apiResponse: unknown, symbol: string, log: LogFn): StockRow[] {
  try {
    const parsed = asYahoo(apiResponse)
    if (!parsed.chart) {
      console.error('API響應缺少chart:', apiResponse)
      throw new Error('API響應格式錯誤：缺少chart節點')
    }
    if (parsed.chart.error) {
      const yahooError = parsed.chart.error
      console.error('Yahoo Finance API錯誤:', yahooError)
      throw new Error(`Yahoo Finance錯誤: ${yahooError.description || yahooError.code || ''}`)
    }
    if (!parsed.chart.result || parsed.chart.result.length === 0) {
      console.error('API響應result為空:', parsed.chart)
      throw new Error('API響應中無有效數據（可能股票代號錯誤或無交易數據）')
    }
    const result = parsed.chart.result[0]
    if (!result?.indicators?.quote || result.indicators.quote.length === 0) {
      console.error('缺少indicators.quote:', result)
      throw new Error('API響應缺少價格數據')
    }
    const quote = result.indicators.quote[0]
    const timestamps = result.timestamp
    if (!quote) throw new Error('API響應缺少價格數據')
    if (!timestamps || timestamps.length === 0) {
      console.error('timestamps為空:', result)
      const meta = result.meta
      if (meta) {
        log(`⚠️ 股票 ${symbol} 的元數據: 交易所=${meta.exchangeName ?? ''}, 貨幣=${meta.currency ?? ''}`, 'warning')
        if (meta.tradingPeriods && meta.tradingPeriods.length === 0) {
          throw new Error('選擇的日期範圍內無交易數據（可能是週末、假日或未來日期）')
        }
      }
      throw new Error('無時間序列數據（請檢查日期範圍是否正確）')
    }
    log(`📊 解析 ${symbol} 數據: ${timestamps.length} 個時間點`)
    const stockData: StockRow[] = []
    for (let index = 0; index < timestamps.length; index += 1) {
      const close = quote.close?.[index]
      if (!close) continue
      const stamp = timestamps[index]
      if (stamp == null) continue
      const date = new Date(stamp * 1000)
      const dateStr = date.toISOString().replace('T', ' ').substring(0, 19)
      const open = quote.open?.[index]
      const high = quote.high?.[index]
      const low = quote.low?.[index]
      stockData.push({
        Symbol: symbol,
        Date: dateStr,
        Open: open ? Number(open.toFixed(2)) : Number(close.toFixed(2)),
        High: high ? Number(high.toFixed(2)) : Number(close.toFixed(2)),
        Low: low ? Number(low.toFixed(2)) : Number(close.toFixed(2)),
        Close: Number(close.toFixed(2)),
        Volume: quote.volume?.[index] || 0,
      })
    }
    log(`✅ 成功解析 ${stockData.length} 筆 ${symbol} 真實市場數據`)
    return stockData
  } catch (error) {
    const message = errorMessage(error)
    log(`❌ 數據解析失敗: ${message}`, 'error')
    throw new Error(`數據解析失敗: ${message}`)
  }
}

async function requestChart(url: string, treatRateLimit: boolean): Promise<unknown> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  })
  if (!response.ok) {
    if (treatRateLimit && response.status === 429) throw new Error('速率限制超出 (HTTP 429)：請稍後再試')
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json() as Promise<unknown>
}

async function fetchYahooFinanceData(
  symbol: string,
  startDate: string,
  endDate: string,
  interval: string,
  log: LogFn,
): Promise<StockRow[]> {
  const period1 = Math.floor(new Date(startDate).getTime() / 1000)
  const period2 = Math.floor(new Date(endDate).getTime() / 1000)
  try {
    log(`📡 通過 corsproxy.io 獲取 ${symbol} 數據（包含盤前盤後）...`)
    let data = await requestChart(proxyUrl(symbol, period1, period2, interval, true), true)
    log(`✅ 成功獲取 ${symbol} 數據`)
    try {
      return parseYahooFinanceResponse(data, symbol, log)
    } catch {
      log('⚠️ 包含盤前盤後數據失敗，嘗試只獲取正常交易時段...', 'warning')
      data = await requestChart(proxyUrl(symbol, period1, period2, interval, false), false)
      log(`✅ 成功獲取 ${symbol} 正常交易時段數據`)
      return parseYahooFinanceResponse(data, symbol, log)
    }
  } catch (error) {
    const message = errorMessage(error)
    log(`❌ corsproxy.io 請求失敗: ${message}`, 'error')
    if (message.includes('429') || message.includes('速率限制')) {
      throw new Error('corsproxy.io 速率限制：請等待幾分鐘後再試，或考慮減少同時下載的股票數量')
    }
    throw new Error(`無法通過 corsproxy.io 獲取數據：${message}`)
  }
}

export async function downloadStockData(
  symbol: string,
  startDate: string,
  endDate: string,
  interval: string,
  log: LogFn,
): Promise<StockFetch> {
  try {
    if (!validateStockSymbol(symbol)) {
      return { success: false, records: 0, message: '無效的股票代號格式', data: null }
    }
    const validation = validateYfinanceLimits(startDate, endDate, interval)
    if (!validation.valid) {
      return { success: false, records: 0, message: validation.message, data: null }
    }
    const stockData = await fetchYahooFinanceData(symbol, startDate, endDate, interval, log)
    if (stockData.length > 0) {
      return {
        success: true,
        records: stockData.length,
        message: `成功獲取 ${stockData.length} 筆真實市場數據`,
        data: stockData,
      }
    }
    return {
      success: false,
      records: 0,
      message: '無法獲取該股票的數據，可能代號不存在或市場已收盤',
      data: null,
    }
  } catch (error) {
    console.error('Yahoo Finance API調用失敗:', error)
    return { success: false, records: 0, message: `API調用失敗: ${errorMessage(error)}`, data: null }
  }
}

export function convertToCSV(data: ReadonlyArray<Record<string, string | number>>): string {
  const first = data[0]
  if (!first) return ''
  const headers = Object.keys(first)
  return [headers.join(','), ...data.map((row) => headers.map((header) => `"${row[header] ?? ''}"`).join(','))].join('\n')
}

function convertToJSON(data: StockRow[], symbol: string): string {
  const first = data[0]
  const last = data[data.length - 1]
  const summary =
    first && last
      ? {
          priceRange: {
            highest: Math.max(...data.map((row) => row.High)),
            lowest: Math.min(...data.map((row) => row.Low)),
            latestClose: last.Close,
            firstClose: first.Close,
          },
          volume: {
            total: data.reduce((sum, row) => sum + row.Volume, 0),
            average: Math.round(data.reduce((sum, row) => sum + row.Volume, 0) / data.length),
            max: Math.max(...data.map((row) => row.Volume)),
            min: Math.min(...data.map((row) => row.Volume)),
          },
        }
      : null
  const jsonData = {
    metadata: {
      symbol,
      dataSource: 'Yahoo Finance API (via corsproxy.io)',
      generatedAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      recordCount: data.length,
      dateRange: first && last ? { start: first.Date, end: last.Date } : null,
      columns: [
        { name: 'Symbol', type: 'string', description: '股票代號' },
        { name: 'Date', type: 'string', description: '交易日期時間' },
        { name: 'Open', type: 'number', description: '開盤價' },
        { name: 'High', type: 'number', description: '最高價' },
        { name: 'Low', type: 'number', description: '最低價' },
        { name: 'Close', type: 'number', description: '收盤價' },
        { name: 'Volume', type: 'integer', description: '成交量' },
      ],
    },
    summary,
    data: data.map((row, index) => {
      const previous = index > 0 ? data[index - 1] : undefined
      return {
        symbol: row.Symbol,
        date: row.Date,
        open: Number(row.Open.toFixed(2)),
        high: Number(row.High.toFixed(2)),
        low: Number(row.Low.toFixed(2)),
        close: Number(row.Close.toFixed(2)),
        volume: Number.parseInt(String(row.Volume), 10),
        changePercent: previous
          ? Number((((row.Close - previous.Close) / previous.Close) * 100).toFixed(2))
          : null,
      }
    }),
    version: '1.0',
    format: 'Yahoo Finance Stock Data JSON',
  }
  return JSON.stringify(jsonData, null, 2)
}

async function convertToSQLite(data: StockRow[], tableName: string, log?: LogFn): Promise<Blob> {
  const SQL = await loadSqlJs()
  const db = new SQL.Database()
  try {
    const safeName = tableName.replace(/[^a-zA-Z0-9_]/g, '_')
    const symbolDefault = tableName.replace(/'/g, "''")
    db.run(`CREATE TABLE stock_${safeName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL DEFAULT '${symbolDefault}',
      date TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)
    db.run(`CREATE INDEX idx_${safeName}_date ON stock_${safeName}(date)`)
    db.run(`CREATE INDEX idx_${safeName}_symbol ON stock_${safeName}(symbol)`)
    db.run('BEGIN TRANSACTION')
    for (const row of data) {
      db.run(
        `INSERT INTO stock_${safeName} (symbol, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.Symbol || tableName, row.Date, row.Open, row.High, row.Low, row.Close, row.Volume],
      )
    }
    db.run('COMMIT')
    return exportDatabaseBlob(db)
  } catch (error) {
    const message = errorMessage(error)
    console.error('SQLite生成失敗:', error)
    log?.(`❌ SQLite數據庫生成失敗: ${message}`, 'error')
    throw new Error(`SQLite數據庫生成失敗: ${message}`)
  } finally {
    db.close()
  }
}

export async function downloadStockFile(data: StockRow[], filename: string, format: OutputFormat, log?: LogFn): Promise<void> {
  if (format === 'SQLite') {
    downloadFile(await convertToSQLite(data, filename, log), `${filename}.db`)
    return
  }
  if (format === 'Excel') {
    downloadFile(
      writeXlsx({
        headers: ['股票代號', '日期', '開盤價', '最高價', '最低價', '收盤價', '成交量'],
        rows: data.map((row) => [
          row.Symbol,
          row.Date,
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
  if (format === 'JSON') {
    downloadFile(`\uFEFF${convertToJSON(data, filename)}`, `${filename}.json`, 'application/json;charset=utf-8')
    return
  }
  downloadFile(`\uFEFF${convertToCSV(data)}`, `${filename}.csv`, 'text/csv;charset=utf-8')
}
