import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Banner, Button, Field, Segmented, Select, Table, Tabs, TextArea } from '@/components/ui'
import './tool.css'
import {
  FORMATS,
  INTERVALS,
  MARKETS,
  dateInputValue,
  describeSymbols,
  downloadStockData,
  downloadStockFile,
  errorMessage,
  initialStockDates,
  intervalWarning,
  loadStockSettings,
  marketByValue,
  parseSymbols,
  saveStockSettings,
  sleep,
  validateDateRange,
  validateStockForm,
  type LogType,
  type OutputFormat,
  type StockFetch,
  type StockRow,
  type SymbolStatus,
} from './logic'

type Busy = 'download' | 'export' | 'retry' | null

type LogEntry = {
  id: string
  time: string
  message: string
  type: LogType
}

type ProgressState = {
  current: number
  total: number
  message: string
}

type StockResult = StockFetch & {
  symbol: string
  outputFormat: OutputFormat
}

const DEFAULT_SYMBOLS = 'AAPL, MSFT, GOOGL'

function logEntry(message: string, type: LogType): LogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toLocaleTimeString(),
    message,
    type,
  }
}

function completionMessage(results: StockResult[], totalRecords: number): string {
  const successCount = results.filter((item) => item.success).length
  const failedCount = results.length - successCount
  let message = `下載完成!\n成功: ${successCount} 隻\n失敗: ${failedCount} 隻\n總記錄數: ${totalRecords.toLocaleString()}`
  const failed = results.filter((item) => !item.success)
  if (failed.length > 0) {
    message += '\n\n失敗的股票:\n'
    failed.slice(0, 5).forEach((item) => {
      message += `• ${item.symbol}: ${item.message.substring(0, 50)}...\n`
    })
    if (failed.length > 5) message += `... 還有 ${failed.length - 5} 個失敗項目\n`
  }
  return message
}

function AdvancedNotes() {
  return (
    <div className="market-stack">
      <Banner tone="info" title="資料來源">
        透過 corsproxy.io 轉送 Yahoo Finance chart API。先請求 includePrePost=true；若解析失敗，再以
        includePrePost=false 重試。events 為 div,split。
      </Banner>
      <div className="market-note-grid">
        <div className="market-stack">
          <h2>時間間隔限制</h2>
          <ul className="market-notes">
            <li>1 分鐘：最多 7 天，且結束日須落在最近 30 天內</li>
            <li>2、5、15、30 分鐘：範圍最多 59 天，開始日須在最近 60 天內</li>
            <li>60 分鐘與 1 小時：最多 729 天</li>
            <li>日線、週線、月線：可取較長歷史</li>
          </ul>
        </div>
        <div className="market-stack">
          <h2>使用提醒</h2>
          <ul className="market-notes">
            <li>多檔之間會等待 2 秒，以降低 corsproxy.io 速率限制</li>
            <li>可分別下載、合併成一個檔，或只重試失敗項目</li>
            <li>資料可能延遲或缺失，僅供個人研究與教育</li>
            <li>不建議用於交易決策</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function Tool() {
  const [saved] = useState(loadStockSettings)
  const [initialDates] = useState(initialStockDates)
  const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS)
  const [symbolStatus, setSymbolStatus] = useState<SymbolStatus>(() => describeSymbols(DEFAULT_SYMBOLS))
  const [market, setMarket] = useState(saved.market)
  const [interval, setIntervalValue] = useState(saved.interval)
  const [start, setStart] = useState(initialDates.start)
  const [end, setEnd] = useState(initialDates.end)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(saved.outputFormat)
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [results, setResults] = useState<StockResult[]>([])
  const [busy, setBusy] = useState<Busy>(null)

  const resultsRef = useRef<StockResult[]>([])
  const busyRef = useRef<Busy>(null)
  const runningRef = useRef(false)
  const stopRef = useRef(false)
  const aliveRef = useRef(true)
  const logPane = useRef<HTMLDivElement>(null)
  const formRef = useRef({ start, end, interval })
  formRef.current = { start, end, interval }

  const pushLog = useCallback((message: string, type: LogType = 'info') => {
    setLogs((prev) => [...prev, logEntry(message, type)])
  }, [])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    const node = logPane.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [logs])

  useEffect(() => {
    const timer = window.setTimeout(() => setSymbolStatus(describeSymbols(symbols)), 1000)
    return () => window.clearTimeout(timer)
  }, [symbols])

  useEffect(() => {
    const message = validateDateRange(initialDates.start, initialDates.end, saved.interval)
    if (message) setErrors([message])
  }, [initialDates.end, initialDates.start, saved.interval])

  function applyDateCheck(nextStart: string, nextEnd: string, nextInterval: string) {
    const message = validateDateRange(nextStart, nextEnd, nextInterval)
    if (message) showErrors([message])
    else setErrors([])
  }

  function showErrors(messages: string[]) {
    setErrors(messages)
    setSuccess('')
  }

  function showSuccess(message: string) {
    setSuccess(message)
    setErrors([])
  }

  function syncBusy(next: Busy) {
    busyRef.current = next
    setBusy(next)
  }

  function publishResults(next: StockResult[]) {
    resultsRef.current = next
    if (aliveRef.current) setResults(next)
  }

  async function handleDownload(event: FormEvent) {
    event.preventDefault()
    if (runningRef.current || busyRef.current) return
    const formErrors = validateStockForm(symbols, start, end, interval)
    if (formErrors.length > 0) {
      showErrors(formErrors)
      return
    }
    const format = outputFormat
    const startDate = start
    const endDate = end
    const nextInterval = interval
    const parsed = parseSymbols(symbols, marketByValue(market).suffix)
    saveStockSettings({
      market,
      interval: nextInterval,
      outputFormat: format,
      startDate,
      endDate,
    })
    runningRef.current = true
    stopRef.current = false
    syncBusy('download')
    publishResults([])
    setErrors([])
    setSuccess('')
    pushLog(`開始下載 ${parsed.length} 隻股票的數據`)
    pushLog(`時間範圍: ${startDate} 至 ${endDate}`)
    pushLog(`時間間隔: ${nextInterval}, 輸出格式: ${format}`)
    const collected: StockResult[] = []
    let completed = 0
    let totalRecords = 0
    try {
      for (const symbol of parsed) {
        if (!aliveRef.current || stopRef.current) break
        setProgress({ current: completed, total: parsed.length, message: `正在下載 ${symbol}...` })
        pushLog(`開始下載 ${symbol}`)
        try {
          const fetched = await downloadStockData(symbol, startDate, endDate, nextInterval, pushLog)
          collected.push({ ...fetched, symbol, outputFormat: format })
          if (fetched.success) totalRecords += fetched.records
          pushLog(
            fetched.success ? `✅ ${symbol}: ${fetched.message}` : `❌ ${symbol}: ${fetched.message}`,
            fetched.success ? 'success' : 'error',
          )
        } catch (error) {
          const message = `下載失敗: ${errorMessage(error)}`
          collected.push({ symbol, success: false, records: 0, message, data: null, outputFormat: format })
          pushLog(`❌ ${symbol}: ${message}`, 'error')
        }
        completed += 1
        if (aliveRef.current) setProgress({ current: completed, total: parsed.length, message: '' })
        if (completed < parsed.length && !stopRef.current && aliveRef.current) {
          pushLog('⏳ 等待 2 秒後繼續下載下一個股票（遵守服務限制）...')
          await sleep(2000)
        }
      }
      if (!aliveRef.current) return
      if (completed > 0) {
        const successCount = collected.filter((item) => item.success).length
        const failedCount = collected.length - successCount
        pushLog(`下載完成! 成功: ${successCount}, 失敗: ${failedCount}, 總記錄數: ${totalRecords}`, 'success')
        publishResults(collected)
        showSuccess(completionMessage(collected, totalRecords))
      } else {
        pushLog('下載被中止', 'warning')
      }
    } finally {
      runningRef.current = false
      if (aliveRef.current) syncBusy(null)
    }
  }

  function stopDownload() {
    if (!runningRef.current || stopRef.current) return
    stopRef.current = true
    pushLog('用戶停止下載', 'warning')
  }

  async function retryAt(index: number) {
    const current = resultsRef.current[index]
    if (!current) return
    pushLog(`重試下載 ${current.symbol}`)
    try {
      const latest = formRef.current
      const fetched = await downloadStockData(current.symbol, latest.start, latest.end, latest.interval, pushLog)
      const next = resultsRef.current.slice()
      next[index] = { ...fetched, symbol: current.symbol, outputFormat: current.outputFormat }
      publishResults(next)
      pushLog(
        fetched.success ? `✅ ${current.symbol}: 重試成功` : `❌ ${current.symbol}: 重試失敗`,
        fetched.success ? 'success' : 'error',
      )
    } catch (error) {
      pushLog(`❌ ${current.symbol}: 重試失敗 - ${errorMessage(error)}`, 'error')
    }
  }

  async function retryFailed() {
    if (busyRef.current) return
    const failed = resultsRef.current.filter((item) => !item.success)
    if (failed.length === 0) {
      showErrors(['沒有失敗的下載項目'])
      return
    }
    syncBusy('retry')
    pushLog(`開始重試 ${failed.length} 個失敗項目`)
    try {
      for (const result of failed) {
        if (!aliveRef.current) return
        const index = resultsRef.current.indexOf(result)
        if (index >= 0) await retryAt(index)
      }
    } finally {
      if (aliveRef.current) syncBusy(null)
    }
  }

  async function downloadOne(result: StockResult) {
    if (!result.success || !result.data || busyRef.current) return
    syncBusy('export')
    try {
      await downloadStockFile(
        result.data,
        `${result.symbol}_${result.outputFormat.toLowerCase()}_data`,
        result.outputFormat,
        pushLog,
      )
    } catch (error) {
      showErrors([errorMessage(error)])
    } finally {
      if (aliveRef.current) syncBusy(null)
    }
  }

  async function downloadAll() {
    const ready = resultsRef.current.filter((item) => item.success && item.data)
    if (ready.length === 0) {
      showErrors(['沒有成功的下載結果'])
      return
    }
    if (busyRef.current) return
    syncBusy('export')
    try {
      if (ready.length === 1) {
        const only = ready[0]
        if (only?.data) await downloadStockFile(only.data, `${only.symbol}_data`, only.outputFormat, pushLog)
        return
      }
      showSuccess(`開始批量下載 ${ready.length} 個文件...`)
      for (let index = 0; index < ready.length; index += 1) {
        const result = ready[index]
        if (!result?.data) continue
        await downloadStockFile(result.data, `${result.symbol}_data`, result.outputFormat, pushLog)
        if (index < ready.length - 1) await sleep(500)
      }
      showSuccess(`已完成下載 ${ready.length} 個文件`)
    } catch (error) {
      showErrors([errorMessage(error)])
    } finally {
      if (aliveRef.current) syncBusy(null)
    }
  }

  async function downloadCombined() {
    const ready = resultsRef.current.filter((item) => item.success && item.data)
    if (ready.length === 0) {
      showErrors(['沒有成功的下載結果'])
      return
    }
    if (busyRef.current) return
    const combined: StockRow[] = []
    for (const result of ready) {
      for (const row of result.data ?? []) {
        combined.push({
          Symbol: result.symbol,
          Date: row.Date,
          Open: row.Open,
          High: row.High,
          Low: row.Low,
          Close: row.Close,
          Volume: row.Volume,
        })
      }
    }
    combined.sort((a, b) => (a.Date < b.Date ? -1 : a.Date > b.Date ? 1 : 0))
    const filename = `combined_stock_data_${dateInputValue(new Date())}`
    syncBusy('export')
    try {
      await downloadStockFile(combined, filename, outputFormat, pushLog)
      showSuccess(`已下載合併文件，包含 ${combined.length} 筆記錄`)
    } catch (error) {
      showErrors([`合併文件下載失敗: ${errorMessage(error)}`])
    } finally {
      if (aliveRef.current) syncBusy(null)
    }
  }

  function clearForm() {
    if (busyRef.current) return
    const dates = initialStockDates()
    setSymbols('')
    setSymbolStatus(describeSymbols(''))
    setMarket('美國')
    setIntervalValue('1d')
    setOutputFormat('CSV')
    setStart(dates.start)
    setEnd(dates.end)
    setProgress(null)
    publishResults([])
    setErrors([])
    setSuccess('')
    setLogs([logEntry('表單已清空', 'info')])
  }

  function refreshData() {
    setSymbolStatus(describeSymbols(symbols))
    const message = validateDateRange(start, end, interval)
    if (message) {
      showErrors([message])
      return
    }
    showSuccess('數據已重新整理')
    window.setTimeout(() => {
      setSuccess((current) => (current === '數據已重新整理' ? '' : current))
    }, 2000)
  }

  async function retryOne(index: number) {
    if (busyRef.current) return
    syncBusy('retry')
    try {
      await retryAt(index)
    } finally {
      if (aliveRef.current) syncBusy(null)
    }
  }

  const warning = intervalWarning(interval)
  const selectedMarket = marketByValue(market)
  const successCount = results.filter((item) => item.success).length
  const failedCount = results.length - successCount
  const totalRecords = results.reduce((sum, item) => sum + item.records, 0)
  const percent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const locked = busy !== null

  const form = (
    <form className="market-form" onSubmit={(event) => void handleDownload(event)}>
      <div className="market-symbol-grid">
        <div className="market-stack">
          <TextArea
            label="股票代號"
            value={symbols}
            rows={4}
            required
            spellCheck={false}
            autoCapitalize="characters"
            placeholder={'輸入股票代號，多個用逗號或換行分隔\n例如: AAPL, MSFT, GOOGL\n2330.TW, 2317.TW'}
            onChange={(event) => setSymbols(event.target.value)}
          />
          <p className={`market-status market-status--${symbolStatus.tone}`} role="status">
            {symbolStatus.text}
          </p>
        </div>
        <div className="market-stack">
          <Select
            label="市場"
            value={market}
            options={MARKETS.map((item) => ({ value: item.value, label: item.label }))}
            hint={`範例：${selectedMarket.examples}`}
            onChange={(event) => setMarket(event.target.value)}
          />
          <Select
            label="時間間隔"
            value={interval}
            options={INTERVALS.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(event) => {
              setIntervalValue(event.target.value)
              applyDateCheck(start, end, event.target.value)
            }}
          />
          <Banner tone={warning.tone}>{warning.text}</Banner>
        </div>
      </div>
      <div className="market-pair">
        <div className="market-stack">
          <h2>日期範圍</h2>
          <div className="market-dates">
            <Field
              label="開始"
              type="date"
              required
              value={start}
              onChange={(event) => {
                setStart(event.target.value)
                applyDateCheck(event.target.value, end, interval)
              }}
            />
            <Field
              label="結束"
              type="date"
              required
              value={end}
              onChange={(event) => {
                setEnd(event.target.value)
                applyDateCheck(start, event.target.value, interval)
              }}
            />
          </div>
          <p className="market-muted">系統會依 Yahoo Finance 的間隔限制檢查日期範圍。</p>
        </div>
        <div className="market-stack">
          <div className="market-format">
            <Segmented
              label="格式"
              value={outputFormat}
              options={FORMATS.map((item) => ({ value: item.value, label: item.label }))}
              onChange={(value) => {
                if (FORMATS.some((item) => item.value === value)) setOutputFormat(value as OutputFormat)
              }}
            />
          </div>
          <ul className="market-hint-list">
            <li>CSV：通用文字</li>
            <li>Excel：試算表</li>
            <li>SQLite：真正的 .db 資料庫，可直接查詢</li>
            <li>JSON：含摘要的結構化資料</li>
          </ul>
        </div>
      </div>
      <div className="market-actions">
        <Button variant="ghost" onClick={refreshData} disabled={locked}>
          重新整理
        </Button>
        <Button variant="ghost" onClick={clearForm} disabled={locked}>
          清空
        </Button>
        <Button type="submit" disabled={locked}>
          {busy === 'download' ? '下載中' : '開始下載'}
        </Button>
        {busy === 'download' ? (
          <Button variant="danger" onClick={stopDownload}>
            停止
          </Button>
        ) : null}
        {failedCount > 0 && busy !== 'download' ? (
          <Button variant="ghost" onClick={() => void retryFailed()} disabled={locked}>
            重試失敗
          </Button>
        ) : null}
      </div>
    </form>
  )

  return (
    <div className="market-tool">
      {errors.length > 0 ? (
        <Banner tone="danger" title="請先修正">
          <ul className="market-error-list">
            {errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Banner>
      ) : null}
      {success ? (
        <Banner tone="success">
          <p className="market-pre">{success}</p>
        </Banner>
      ) : null}
      <Tabs
        label="股票數據設定"
        tabs={[
          { id: 'basic', label: '基本設定', content: form },
          { id: 'advanced', label: '進階說明', content: <AdvancedNotes /> },
        ]}
      />
      {progress ? (
        <section className="market-section" aria-label="下載進度">
          <h2>下載進度</h2>
          <div
            className="market-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="下載進度"
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="market-progress-meta">
            <span>{progress.message || `${progress.current}/${progress.total}`}</span>
            <span>{percent}%</span>
          </div>
        </section>
      ) : null}
      {logs.length > 0 ? (
        <section className="market-section" aria-label="下載日誌">
          <div className="market-head">
            <h2>下載日誌</h2>
            <Button variant="ghost" onClick={() => setLogs([])} disabled={busy === 'download'}>
              清空日誌
            </Button>
          </div>
          <div className="market-log" ref={logPane} role="log" aria-label="下載日誌">
            {logs.map((entry) => (
              <div key={entry.id} className={`market-log-line market-log-line--${entry.type}`}>
                <span className="market-log-time">[{entry.time}]</span>
                {entry.message}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {results.length > 0 ? (
        <section className="market-section" aria-label="下載結果">
          <div className="market-head">
            <h2>下載結果</h2>
            <div className="market-head-actions">
              <Button variant="ghost" onClick={() => void downloadAll()} disabled={locked}>
                分別下載全部
              </Button>
              <Button onClick={() => void downloadCombined()} disabled={locked}>
                合併下載
              </Button>
              {failedCount > 0 ? (
                <Button variant="ghost" onClick={() => void retryFailed()} disabled={locked}>
                  重試失敗
                </Button>
              ) : null}
            </div>
          </div>
          <div className="market-stats">
            <div className="market-stat market-stat--ok">
              <strong>{successCount}</strong>
              <span>成功</span>
            </div>
            <div className="market-stat market-stat--bad">
              <strong>{failedCount}</strong>
              <span>失敗</span>
            </div>
            <div className="market-stat">
              <strong>{results.length}</strong>
              <span>總計</span>
            </div>
            <div className="market-stat market-stat--accent">
              <strong>{totalRecords.toLocaleString()}</strong>
              <span>總記錄數</span>
            </div>
          </div>
          <div className="market-results">
            <Table
              label="股票下載結果"
              rows={results.map((result, index) => ({ ...result, index }))}
              getRowKey={(row) => `${row.index}-${row.symbol}`}
              columns={[
                { key: 'symbol', header: '股票代號', width: '16%', render: (row) => row.symbol },
                {
                  key: 'status',
                  header: '狀態',
                  width: '12%',
                  render: (row) => (
                    <span className={row.success ? 'market-status market-status--ok' : 'market-status market-status--bad'}>
                      {row.success ? '成功' : '失敗'}
                    </span>
                  ),
                },
                {
                  key: 'records',
                  header: '記錄數',
                  width: '12%',
                  render: (row) => row.records.toLocaleString(),
                },
                { key: 'message', header: '訊息', render: (row) => row.message },
                {
                  key: 'action',
                  header: '操作',
                  width: '8rem',
                  render: (row) =>
                    row.success ? (
                      <Button variant="ghost" onClick={() => void downloadOne(row)} disabled={locked}>
                        下載
                      </Button>
                    ) : (
                      <Button variant="ghost" onClick={() => void retryOne(row.index)} disabled={locked}>
                        重試
                      </Button>
                    ),
                },
              ]}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
