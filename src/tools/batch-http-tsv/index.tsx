import { useEffect, useRef, useState } from 'react'
import {
  Banner,
  Button,
  Checkbox,
  Field,
  FileInput,
  Modal,
  Select,
  Table,
  TextArea,
  type TableColumn,
} from '@/components/ui'
import { downloadFile, runHttpBatch, type HttpBatchRequest } from '@/lib'
import './tool.css'

type Method = 'GET' | 'POST'
type AuthType = 'Basic' | 'Bearer'
type Notice = { tone: 'info' | 'success' | 'warning' | 'danger'; text: string } | null
type LogTone = 'ok' | 'bad' | 'pending'

type TsvConfig = {
  method: Method
  getUrl: string
  postUrl: string
  postBody: string
  delay: string
  enableAuth: boolean
  authType: AuthType
  authUsername: string
  authPassword: string
  authToken: string
  rows: string[][]
}

type LogItem = {
  id: string
  title: string
  detail: string
  outcome: string
  full: string
  clipped: boolean
  expanded: boolean
  tone: LogTone
}

type RowModel = { index: number; cells: string[] }

const STORAGE_KEY = 'httpRequestConfig'

function emptyConfig(): TsvConfig {
  return {
    method: 'GET',
    getUrl: '',
    postUrl: '',
    postBody: '',
    delay: '3000',
    enableAuth: false,
    authType: 'Basic',
    authUsername: '',
    authPassword: '',
    authToken: '',
    rows: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function textOf(value: unknown, fallback = '') {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function columnWidth(rows: string[][]) {
  return rows.reduce((max, row) => Math.max(max, row.length), 0)
}

function pad(rows: string[][], width: number) {
  return rows.map((row) => {
    const next = row.slice()
    while (next.length < width) next.push('')
    return next
  })
}

function sanitizeRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return []
  const rows = value
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => (cell == null ? '' : String(cell))))
  const width = columnWidth(rows)
  if (width === 0) return []
  return pad(rows, width)
}

function fromStored(value: Record<string, unknown>): TsvConfig {
  return {
    method: value.requestMethod === 'POST' ? 'POST' : 'GET',
    getUrl: textOf(value.getUrlTemplate),
    postUrl: textOf(value.postUrlTemplate),
    postBody: textOf(value.postBodyTemplate),
    delay: textOf(value.requestDelay, '3000'),
    enableAuth: value.enableAuth === true,
    authType: value.authType === 'Bearer' ? 'Bearer' : 'Basic',
    authUsername: textOf(value.authUsername),
    authPassword: textOf(value.authPassword),
    authToken: textOf(value.authToken),
    rows: sanitizeRows(value.tableData),
  }
}

function toStored(config: TsvConfig) {
  return {
    tableData: config.rows.map((row) => row.map((cell) => cell.trim())),
    requestMethod: config.method,
    getUrlTemplate: config.getUrl,
    postUrlTemplate: config.postUrl,
    postBodyTemplate: config.postBody,
    requestDelay: config.delay,
    enableAuth: config.enableAuth,
    authType: config.authType,
    authUsername: config.authUsername,
    authPassword: config.authPassword,
    authToken: config.authToken,
  }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10)
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function positiveDelay(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function sleep(ms: number, signal: AbortSignal) {
  if (ms <= 0 || signal.aborted) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(finish, ms)
    function finish() {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }
    function onAbort() {
      window.clearTimeout(timer)
      finish()
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyParams(template: string, params: Record<string, string>, encode: boolean) {
  let output = template
  for (const [key, value] of Object.entries(params)) {
    output = output.replace(new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g'), () =>
      encode ? encodeURIComponent(value) : value,
    )
  }
  return output
}

function tidyPostBody(body: string) {
  let next = body.replace(/,\s*}/g, '}').replace(/^\s+|\s+$/g, '')
  if (!/^\s*\{/.test(next)) next = `{${next}}`
  return next
}

function clipText(text: string, max: number) {
  if (text.length <= max) return { outcome: text, full: text, clipped: false }
  return { outcome: `${text.slice(0, max)} ... (點擊展開)`, full: text, clipped: true }
}

function describeOutcome(ok: boolean, status: number, bodyText: string, error: string | undefined) {
  if (error) return clipText(`失敗：${error}`, 200)
  if (ok) return clipText(`成功：${bodyText}`, 200)
  return clipText(`失敗（HTTP ${status}）：${bodyText}`, 200)
}

function resolveAuth(config: TsvConfig): { headers: Record<string, string> } | { error: string } {
  if (!config.enableAuth) return { headers: {} }
  if (config.authType === 'Basic') {
    const username = config.authUsername.trim()
    const password = config.authPassword.trim()
    if (!username || !password) return { error: 'Basic Auth 需要用戶名和密碼' }
    try {
      return { headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}` } }
    } catch {
      return { error: 'Basic Auth 只能使用 Latin-1 字元' }
    }
  }
  const token = config.authToken.trim()
  if (!token) return { error: 'Bearer Auth 需要 Token' }
  return { headers: { Authorization: `Bearer ${token}` } }
}

export default function Tool() {
  const [config, setConfig] = useState(emptyConfig)
  const [batchText, setBatchText] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const runningRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const columnCount = columnWidth(config.rows)
  const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (isRecord(parsed)) setConfig(fromStored(parsed))
      }
    } catch {
      setNotice({ tone: 'danger', text: '讀取已儲存配置失敗' })
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStored(config)))
  }, [ready, config])

  useEffect(() => {
    if (!notice || notice.tone !== 'danger') return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const node = logRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [logs])

  useEffect(() => () => abortRef.current?.abort(), [])

  function patch(partial: Partial<TsvConfig>) {
    setConfig((prev) => ({ ...prev, ...partial }))
  }

  function addRows(incoming: string[][]) {
    setConfig((prev) => {
      let width = Math.max(columnWidth(prev.rows), 1)
      for (const line of incoming) width = Math.max(width, line.length, 1)
      return {
        ...prev,
        rows: [...pad(prev.rows, width), ...incoming.map((line) => pad([line], width)[0] ?? [])],
      }
    })
  }

  function addBatch() {
    const lines = batchText
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/).filter(Boolean))
    if (lines.length === 0 || (lines.length === 1 && lines[0]?.length === 0)) {
      setNotice({ tone: 'danger', text: '請輸入有效數據！' })
      return
    }
    addRows(lines)
    setBatchText('')
  }

  function updateCell(rowIndex: number, col: number, value: string) {
    setConfig((prev) => ({
      ...prev,
      rows: prev.rows.map((row, index) => {
        if (index !== rowIndex) return row
        const copy = row.slice()
        while (copy.length <= col) copy.push('')
        copy[col] = value
        return copy
      }),
    }))
  }

  function putLog(item: LogItem) {
    setLogs((prev) => {
      const index = prev.findIndex((entry) => entry.id === item.id)
      if (index < 0) return [...prev, item]
      const next = prev.slice()
      next[index] = { ...item, expanded: prev[index]?.expanded ?? false }
      return next
    })
  }

  async function send() {
    if (runningRef.current) return
    if (config.rows.length === 0) {
      setNotice({ tone: 'danger', text: '表格中無數據，請先添加參數！' })
      return
    }
    const auth = resolveAuth(config)
    if ('error' in auth) {
      setNotice({ tone: 'danger', text: auth.error })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    runningRef.current = true
    setRunning(true)
    setNotice(null)
    setLogs([])
    const total = config.rows.length
    setProgress({ done: 0, total })
    const delay = positiveDelay(config.delay)
    let halted = ''

    try {
      for (let i = 0; i < config.rows.length; i += 1) {
        if (controller.signal.aborted) {
          halted = '已中止，其餘請求未發送'
          break
        }
        const params: Record<string, string> = {}
        ;(config.rows[i] ?? []).forEach((value, index) => {
          params[`Parameter${index + 1}`] = value.trim() || ''
        })
        const id = String(i)
        const title = `請求 ${i + 1}/${total}`
        const template = config.method === 'GET' ? config.getUrl : config.postUrl
        const url = applyParams(template, params, true)
        let body: string | undefined
        if (config.method === 'POST') {
          try {
            body = JSON.stringify(JSON.parse(tidyPostBody(applyParams(config.postBody, params, false))))
          } catch (error) {
            const clipped = clipText(`JSON 格式錯誤: ${messageOf(error)}`, 200)
            putLog({ id, title, detail: url, ...clipped, expanded: false, tone: 'bad' })
            setNotice({ tone: 'danger', text: `行 ${i + 1} JSON 解析失敗：${messageOf(error)}` })
            setProgress({ done: i + 1, total })
            if (delay > 0) await sleep(delay, controller.signal)
            continue
          }
        }
        const detail = config.method === 'POST' ? `${url} (Body: ${body ?? ''})` : url
        putLog({ id, title, detail, outcome: '發送中…', full: '發送中…', clipped: false, expanded: false, tone: 'pending' })
        const headers = { ...auth.headers }
        if (config.method === 'POST') headers['Content-Type'] = 'application/json'
        const request: HttpBatchRequest = {
          method: config.method,
          url,
          headers,
          ...(body !== undefined ? { body } : {}),
        }
        const [result] = await runHttpBatch([request], { concurrency: 1, signal: controller.signal })
        const described = describeOutcome(result?.ok ?? false, result?.status ?? 0, result?.bodyText ?? '', result?.error)
        putLog({ id, title, detail, ...described, expanded: false, tone: result?.ok ? 'ok' : 'bad' })
        if (result && !result.ok) {
          setNotice({ tone: 'danger', text: `請求 ${config.method} ${url} 失敗：${result.error || `HTTP ${result.status}`}` })
        }
        setProgress({ done: i + 1, total })
        if (controller.signal.aborted) {
          halted = '已中止，其餘請求未發送'
          break
        }
        if (delay > 0) await sleep(delay, controller.signal)
      }
      if (halted) setNotice({ tone: 'warning', text: halted })
    } finally {
      runningRef.current = false
      abortRef.current = null
      setRunning(false)
    }
  }

  function confirmClear() {
    abortRef.current?.abort()
    localStorage.removeItem(STORAGE_KEY)
    setConfig(emptyConfig())
    setBatchText('')
    setLogs([])
    setProgress({ done: 0, total: 0 })
    setNotice({ tone: 'success', text: '已清空所有儲存數據' })
    setConfirming(false)
  }

  async function importConfig(files: FileList) {
    const file = files[0]
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isRecord(parsed)) throw new Error('無效的 JSON 格式')
      setConfig(fromStored(parsed))
      setNotice({ tone: 'success', text: '配置已成功匯入' })
    } catch (error) {
      setNotice({ tone: 'danger', text: `匯入失敗：無效的 JSON 格式 (${messageOf(error)})` })
    }
  }

  const model: RowModel[] = config.rows.map((cells, index) => ({ index, cells }))
  const columns: TableColumn<RowModel>[] = Array.from({ length: columnCount }, (_, col) => ({
    key: `c${col}`,
    header: `Parameter${col + 1}`,
    render: (row) => (
      <Field
        label={`Parameter${col + 1}，第 ${row.index + 1} 列`}
        hideLabel
        value={row.cells[col] ?? ''}
        autoComplete="off"
        onChange={(event) => updateCell(row.index, col, event.target.value)}
      />
    ),
  }))

  return (
    <div className="batch-tool">
      {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}

      <section className="batch-section">
        <h2>1. 設置請求配置</h2>
        <p className="batch-help">選擇請求類型並設置 URL 和（若為 POST）JSON 模板，使用 {'{Parameter1}'}、{'{Parameter2}'} 等作為占位符。</p>
        <Select
          label="請求方法"
          value={config.method}
          options={[
            { value: 'GET', label: 'GET' },
            { value: 'POST', label: 'POST (JSON)' },
          ]}
          onChange={(event) => patch({ method: event.target.value === 'POST' ? 'POST' : 'GET' })}
        />
        {config.method === 'GET' ? (
          <Field
            label="GET URL 模板"
            hint="輸入帶有占位符的 URL，例如：https://api.example.com/{Parameter1}"
            value={config.getUrl}
            placeholder="例如: https://api.example.com/{Parameter1}"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => patch({ getUrl: event.target.value })}
          />
        ) : (
          <>
            <Field
              label="POST URL 模板"
              hint="輸入 POST 請求的目標 URL"
              value={config.postUrl}
              placeholder="例如: https://api.example.com/{Parameter1}"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => patch({ postUrl: event.target.value })}
            />
            <TextArea
              label="POST JSON 模板"
              hint="輸入 JSON 格式的請求體，使用占位符替換數據"
              rows={5}
              value={config.postBody}
              placeholder={'{\n    "key1": "{Parameter1}",\n    "key2": "{Parameter2}"\n}'}
              spellCheck={false}
              onChange={(event) => patch({ postBody: event.target.value })}
            />
          </>
        )}
        <Button variant="ghost" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}>
          進階設置
        </Button>
        {advanced ? (
          <>
            <Field
              label="每次請求間隔 (毫秒)"
              hint="設置為 0 表示無間隔，建議 500ms 或以上以避免伺服器過載"
              type="number"
              min={0}
              step={100}
              value={config.delay}
              onChange={(event) => patch({ delay: event.target.value })}
            />
            <Checkbox label="啟用 HTTP Authorization" checked={config.enableAuth} onChange={(event) => patch({ enableAuth: event.target.checked })} />
            <p className="batch-help">啟用後可設置認證頭，用於需要身份驗證的 API。</p>
            {config.enableAuth ? (
              <>
                <Select
                  label="Authorization 類型"
                  value={config.authType}
                  options={[
                    { value: 'Basic', label: 'Basic' },
                    { value: 'Bearer', label: 'Bearer' },
                  ]}
                  onChange={(event) => patch({ authType: event.target.value === 'Bearer' ? 'Bearer' : 'Basic' })}
                />
                {config.authType === 'Basic' ? (
                  <>
                    <Field label="用戶名" value={config.authUsername} placeholder="輸入用戶名" autoComplete="off" onChange={(event) => patch({ authUsername: event.target.value })} />
                    <Field label="密碼" type="password" value={config.authPassword} placeholder="輸入密碼" autoComplete="off" onChange={(event) => patch({ authPassword: event.target.value })} />
                  </>
                ) : (
                  <Field label="Bearer Token" value={config.authToken} placeholder="輸入 API Token" autoComplete="off" spellCheck={false} onChange={(event) => patch({ authToken: event.target.value })} />
                )}
              </>
            ) : null}
          </>
        ) : null}
        <div className="batch-actions">
          <Button
            variant="ghost"
            title="匯出當前配置"
            onClick={() => {
              downloadFile(JSON.stringify(toStored(config), null, 2), `http-request-config-${dateStamp()}.json`, 'application/json')
              setNotice({ tone: 'success', text: '配置已匯出為 JSON 文件' })
            }}
          >
            匯出配置
          </Button>
          <FileInput label="匯入配置" accept=".json,application/json" hint="從 JSON 文件匯入配置" onFiles={(files) => void importConfig(files)} />
          <Button variant="danger" title="清空儲存的所有數據" onClick={() => setConfirming(true)}>
            清空儲存
          </Button>
        </div>
      </section>

      <section className="batch-section">
        <h2>2. 輸入參數數據</h2>
        <p className="batch-help">輸入多組參數數據，每組將生成一個獨立的請求。每行代表一組參數，空格分隔不同值。</p>
        <TextArea
          label="批量輸入參數"
          rows={5}
          value={batchText}
          placeholder={'每行一組數據，用空格分隔，例如：\nParameter1 Parameter2 Parameter3\nParameter1 Parameter2'}
          onChange={(event) => setBatchText(event.target.value)}
        />
        <div className="batch-actions">
          <Button onClick={addBatch}>批量添加</Button>
          <Button variant="ghost" onClick={() => addRows([[]])}>
            單行添加
          </Button>
        </div>
        {columnCount > 0 ? (
          <div className="http-sheet">
            <Table label="參數數據" columns={columns} rows={model} getRowKey={(row) => String(row.index)} />
          </div>
        ) : (
          <p className="batch-help">尚未加入參數。</p>
        )}
      </section>

      <section className="batch-section">
        <h2>3. 發送請求並查看結果</h2>
        <p className="batch-help">點擊「發送請求」以執行所有請求，並在下方查看結果。</p>
        <div className="batch-actions">
          <Button disabled={running} onClick={() => void send()}>
            發送請求
          </Button>
          {running ? (
            <Button variant="danger" onClick={() => abortRef.current?.abort()}>
              停止
            </Button>
          ) : null}
        </div>
        <p className="batch-help">
          已完成 {progress.done}/{progress.total}
        </p>
        <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="執行進度">
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="batch-log" ref={logRef} aria-live="polite">
          {logs.length === 0 ? <p className="batch-help">尚無結果</p> : null}
          {logs.map((item) => (
            <article key={item.id} className={`batch-result batch-result--${item.tone}`}>
              <h3>{item.title}</h3>
              {item.detail ? <p className="batch-url">{item.detail}</p> : null}
              {item.clipped || item.expanded ? (
                <Button variant="ghost" onClick={() => setLogs((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, expanded: !entry.expanded } : entry)))}>
                  {item.expanded ? item.full : item.outcome}
                </Button>
              ) : (
                <p>{item.outcome}</p>
              )}
            </article>
          ))}
        </div>
      </section>

      <Modal
        open={confirming}
        title="清空儲存"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={confirmClear}>
              確定清空
            </Button>
          </>
        }
      >
        <p>確定要清空所有儲存的數據嗎？此操作無法復原！</p>
      </Modal>
    </div>
  )
}
