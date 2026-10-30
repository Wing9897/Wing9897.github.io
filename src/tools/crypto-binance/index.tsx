import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Banner, Button, Field, Segmented, Select, Table, TextArea } from '@/components/ui'
import './tool.css'
import {
  FORMATS,
  INTERVALS,
  downloadCandleFile,
  errorMessage,
  fetchBinanceData,
  initialMonthRange,
  isOutputFormat,
  parseSymbols,
  sleep,
  type CandleFetch,
  type LogType,
  type OutputFormat,
} from './logic'

type Busy = 'download' | 'export' | null

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

type CandleResult = CandleFetch & {
  symbol: string
  outputFormat: OutputFormat
}

const DEFAULT_SYMBOLS = 'BTCUSDT, ETHUSDT, BNBUSDT'

function logEntry(message: string, type: LogType): LogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toLocaleTimeString(),
    message,
    type,
  }
}

export default function Tool() {
  const initialDates = useState(initialMonthRange)[0]
  const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS)
  const [interval, setIntervalValue] = useState('1d')
  const [start, setStart] = useState(initialDates.start)
  const [end, setEnd] = useState(initialDates.end)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('CSV')
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [results, setResults] = useState<CandleResult[]>([])
  const [busy, setBusy] = useState<Busy>(null)

  const busyRef = useRef<Busy>(null)
  const aliveRef = useRef(true)
  const logPane = useRef<HTMLDivElement>(null)

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

  async function handleDownload(event: FormEvent) {
    event.preventDefault()
    if (busyRef.current) return
    const parsed = parseSymbols(symbols)
    if (parsed.length === 0) {
      showErrors(['請輸入至少一個交易對'])
      return
    }
    const format = outputFormat
    const startDate = start
    const endDate = end
    const nextInterval = interval
    syncBusy('download')
    setResults([])
    setErrors([])
    setSuccess('')
    pushLog(`開始下載 ${parsed.length} 個交易對的數據`)
    pushLog(`時間範圍: ${startDate} 至 ${endDate}`)
    pushLog(`時間間隔: ${nextInterval}, 輸出格式: ${format}`)
    const collected: CandleResult[] = []
    let completed = 0
    try {
      for (const symbol of parsed) {
        if (!aliveRef.current) return
        setProgress({ current: completed, total: parsed.length, message: `正在下載 ${symbol}...` })
        const fetched = await fetchBinanceData(symbol, nextInterval, startDate, endDate, pushLog)
        if (!aliveRef.current) return
        collected.push({ ...fetched, symbol, outputFormat: format })
        completed += 1
        setProgress({ current: completed, total: parsed.length, message: '' })
        if (completed < parsed.length && aliveRef.current) await sleep(500)
      }
      if (!aliveRef.current) return
      const successCount = collected.filter((item) => item.success).length
      const failedCount = collected.length - successCount
      const totalRecords = collected.reduce((sum, item) => sum + item.records, 0)
      pushLog(`下載完成! 成功: ${successCount}, 失敗: ${failedCount}, 總記錄數: ${totalRecords}`, 'success')
      setResults(collected)
      showSuccess(`下載完成! 成功: ${successCount} 個, 失敗: ${failedCount} 個`)
    } catch (error) {
      if (aliveRef.current) showErrors([errorMessage(error)])
    } finally {
      if (aliveRef.current) syncBusy(null)
    }
  }

  async function downloadOne(result: CandleResult) {
    if (!result.success || !result.data || busyRef.current) return
    syncBusy('export')
    try {
      await downloadCandleFile(result.data, `${result.symbol}_binance_${result.outputFormat.toLowerCase()}`, result.outputFormat)
    } catch (error) {
      showErrors([errorMessage(error)])
    } finally {
      if (aliveRef.current) syncBusy(null)
    }
  }

  async function downloadAll() {
    const ready = results.filter((item) => item.success && item.data)
    if (ready.length === 0) {
      showErrors(['沒有成功的下載結果'])
      return
    }
    if (busyRef.current) return
    syncBusy('export')
    try {
      for (let index = 0; index < ready.length; index += 1) {
        const result = ready[index]
        if (!result?.data) continue
        await downloadCandleFile(result.data, `${result.symbol}_binance`, result.outputFormat)
        if (index < ready.length - 1) await sleep(200)
      }
      showSuccess(`已完成下載 ${ready.length} 個文件`)
    } catch (error) {
      showErrors([errorMessage(error)])
    } finally {
      if (aliveRef.current) syncBusy(null)
    }
  }

  function clearForm() {
    if (busyRef.current) return
    const dates = initialMonthRange()
    setSymbols(DEFAULT_SYMBOLS)
    setIntervalValue('1d')
    setStart(dates.start)
    setEnd(dates.end)
    setProgress(null)
    setResults([])
    setErrors([])
    setSuccess('')
    setLogs([])
  }

  const successCount = results.filter((item) => item.success).length
  const failedCount = results.length - successCount
  const totalRecords = results.reduce((sum, item) => sum + item.records, 0)
  const percent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const locked = busy !== null

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
      <form className="market-form" onSubmit={(event) => void handleDownload(event)}>
        <div className="market-symbol-grid">
          <TextArea
            label="交易對代號"
            value={symbols}
            rows={4}
            required
            spellCheck={false}
            autoCapitalize="characters"
            placeholder={'輸入 Binance 交易對，多個用逗號或換行分隔\n例如: BTCUSDT, ETHUSDT, BNBUSDT'}
            onChange={(event) => setSymbols(event.target.value)}
          />
          <div className="market-stack">
            <Select
              label="時間間隔"
              value={interval}
              options={INTERVALS.map((item) => ({ value: item.value, label: item.label }))}
              onChange={(event) => setIntervalValue(event.target.value)}
            />
            <p className="market-muted">常見交易對：BTCUSDT（比特幣）、ETHUSDT（以太坊）、BNBUSDT（幣安幣）。</p>
          </div>
        </div>
        <div className="market-pair">
          <div className="market-stack">
            <h2>日期範圍</h2>
            <div className="market-dates">
              <Field label="開始" type="date" required value={start} onChange={(event) => setStart(event.target.value)} />
              <Field label="結束" type="date" required value={end} onChange={(event) => setEnd(event.target.value)} />
            </div>
            <p className="market-muted">Binance 支援歷史數據，每次請求最多 1000 筆。</p>
          </div>
          <div className="market-format">
            <Segmented
              label="格式"
              value={outputFormat}
              options={FORMATS.map((item) => ({ value: item.value, label: item.label }))}
              onChange={(value) => {
                if (isOutputFormat(value)) setOutputFormat(value)
              }}
            />
          </div>
        </div>
        <div className="market-actions">
          <Button variant="ghost" onClick={clearForm} disabled={locked}>
            清空
          </Button>
          <Button type="submit" disabled={locked}>
            {busy === 'download' ? '下載中' : '開始下載'}
          </Button>
        </div>
      </form>
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
              <Button onClick={() => void downloadAll()} disabled={locked}>
                下載全部
              </Button>
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
              label="Binance 下載結果"
              rows={results.map((result, index) => ({ ...result, index }))}
              getRowKey={(row) => `${row.index}-${row.symbol}`}
              columns={[
                { key: 'symbol', header: '交易對', width: '16%', render: (row) => row.symbol },
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
                { key: 'records', header: '記錄數', width: '12%', render: (row) => row.records.toLocaleString() },
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
                      <span className="market-muted">-</span>
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
