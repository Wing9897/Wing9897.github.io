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

type StandardConfig = {
  method: Method
  urlTemplate: string
  postBody: string
  delay: string
  enableAuth: boolean
  authType: AuthType
  authUsername: string
  authPassword: string
  authToken: string
  inputValues: string
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

const STORAGE_KEY = 'batch-http-standard:requestConfig'
const LEGACY_KEY = 'requestConfig'

function emptyConfig(): StandardConfig {
  return {
    method: 'GET',
    urlTemplate: '',
    postBody: '',
    delay: '3000',
    enableAuth: false,
    authType: 'Basic',
    authUsername: '',
    authPassword: '',
    authToken: '',
    inputValues: '',
    rows: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isStandardConfig(value: Record<string, unknown>) {
  return 'tableData' in value || 'inputValues' in value
}

function isAdvancedConfig(value: Record<string, unknown>) {
  return 'mainExcelData' in value || 'paramExcelData' in value || 'excelData' in value
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

function fromStored(value: Record<string, unknown>): StandardConfig {
  const base = emptyConfig()
  return {
    ...base,
    method: value.method === 'POST' ? 'POST' : 'GET',
    urlTemplate: textOf(value.urlTemplate),
    postBody: textOf(value.postBody),
    delay: textOf(value.delay, '3000'),
    enableAuth: value.enableAuth === true,
    authType: value.authType === 'Bearer' ? 'Bearer' : 'Basic',
    authUsername: textOf(value.authUsername),
    authPassword: textOf(value.authPassword),
    authToken: textOf(value.authToken),
    inputValues: textOf(value.inputValues),
    rows: sanitizeRows(value.tableData),
  }
}

function toStored(config: StandardConfig) {
  return {
    tableData: config.rows,
    inputValues: config.inputValues,
    method: config.method,
    urlTemplate: config.urlTemplate,
    postBody: config.postBody,
    delay: config.delay,
    enableAuth: config.enableAuth,
    authType: config.authType,
    authUsername: config.authUsername,
    authPassword: config.authPassword,
    authToken: config.authToken,
  }
}

function parseRecord(text: string) {
  const parsed: unknown = JSON.parse(text)
  return isRecord(parsed) ? parsed : null
}

function readStored() {
  const own = localStorage.getItem(STORAGE_KEY)
  if (own) return parseRecord(own)
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (!legacy) return null
  const parsed = parseRecord(legacy)
  if (!parsed || !isStandardConfig(parsed) || isAdvancedConfig(parsed)) return null
  return parsed
}

function removeLegacy() {
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (!legacy) return
  try {
    const parsed = parseRecord(legacy)
    if (parsed && isStandardConfig(parsed) && !isAdvancedConfig(parsed)) localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* 舊檔不是這個工具的配置 */
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

function fillStandardBody(template: string, params: Record<string, string>) {
  return template.replace(/\{InputValue\}|\{Parameter\d+\}/g, (match) => params[match.slice(1, -1)] ?? '')
}

function clipText(text: string, max: number) {
  if (text.length <= max) return { outcome: text, full: text, clipped: false }
  return { outcome: `${text.slice(0, max)} ... (點擊展開)`, full: text, clipped: true }
}

function describeOutcome(ok: boolean, status: number, bodyText: string, error: string | undefined) {
  if (error) return clipText(`失敗：${error}`, 100)
  if (ok) return clipText(`成功：${bodyText}`, 100)
  return clipText(`失敗（HTTP ${status}）：${bodyText}`, 100)
}

function resolveAuth(config: StandardConfig): { headers: Record<string, string> } | { error: string } {
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
  const [width, setWidth] = useState(0)
  const [batchText, setBatchText] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [preview, setPreview] = useState('點擊「發送」後顯示預覽')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const runningRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const columnCount = Math.max(width, columnWidth(config.rows))
  const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)

  useEffect(() => {
    try {
      const stored = readStored()
      if (stored) {
        const next = fromStored(stored)
        setConfig(next)
        setWidth(columnWidth(next.rows))
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
    const node = logRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [logs])

  useEffect(() => () => abortRef.current?.abort(), [])

  function patch(partial: Partial<StandardConfig>) {
    setConfig((prev) => ({ ...prev, ...partial }))
  }

  function addRows(incoming: string[][]) {
    let nextWidth = Math.max(columnCount, 1)
    for (const line of incoming) nextWidth = Math.max(nextWidth, line.length)
    setWidth(nextWidth)
    setConfig((prev) => ({
      ...prev,
      rows: [...pad(prev.rows, nextWidth), ...incoming.map((line) => pad([line], nextWidth)[0] ?? [])],
    }))
  }

  function addBatch() {
    const lines = batchText.trim().split('\n').map((line) => line.trim().split(/\s+/))
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
    const inputValues = config.inputValues.trim().split('\n').filter(Boolean)
    if (inputValues.length === 0 || config.rows.length === 0) {
      setNotice({ tone: 'warning', text: '請輸入主值和參數組' })
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
    setPreview('')
    const total = inputValues.length * config.rows.length
    setProgress({ done: 0, total })
    const delay = positiveDelay(config.delay)
    let sent = 0
    let halted = ''

    try {
      for (let i = 0; i < inputValues.length; i += 1) {
        const inputValue = inputValues[i] ?? ''
        setPreview((prev) => `${prev}主值 ${i + 1}: ${inputValue}\n`)
        for (let j = 0; j < config.rows.length; j += 1) {
          if (controller.signal.aborted) {
            halted = '已中止，其餘請求未發送'
            break
          }
          const params: Record<string, string> = { InputValue: inputValue }
          ;(config.rows[j] ?? []).forEach((value, index) => {
            params[`Parameter${index + 1}`] = value
          })
          const url = applyParams(config.urlTemplate, params, true)
          const id = `${i}-${j}`
          const title = `請求 ${sent + 1}/${total}（主值 ${i + 1}，組 ${j + 1}）`
          let body: string | undefined
          if (config.method === 'POST') {
            try {
              body = JSON.stringify(JSON.parse(fillStandardBody(config.postBody, params)))
              setPreview((prev) => `${prev}組 ${j + 1}: ${url} (資料: ${body})\n`)
            } catch (error) {
              const clipped = clipText(`JSON 格式錯誤：${messageOf(error)}`, 100)
              putLog({ id, title, detail: url, ...clipped, expanded: false, tone: 'bad' })
              halted = 'JSON 格式錯誤，其後請求未發送'
              break
            }
          } else {
            setPreview((prev) => `${prev}組 ${j + 1}: ${url}\n`)
          }

          putLog({ id, title, detail: url, outcome: '發送中…', full: '發送中…', clipped: false, expanded: false, tone: 'pending' })
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
          putLog({ id, title, detail: url, ...described, expanded: false, tone: result?.ok ? 'ok' : 'bad' })
          sent += 1
          setProgress({ done: sent, total })
          if (controller.signal.aborted) {
            halted = '已中止，其餘請求未發送'
            break
          }
          if (delay > 0) await sleep(delay, controller.signal)
        }
        setPreview((prev) => `${prev}\n`)
        if (halted) break
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
    removeLegacy()
    setConfig(emptyConfig())
    setWidth(0)
    setBatchText('')
    setLogs([])
    setPreview('點擊「發送」後顯示預覽')
    setProgress({ done: 0, total: 0 })
    setNotice({ tone: 'success', text: '已清空所有儲存數據' })
    setConfirming(false)
  }

  async function importConfig(files: FileList) {
    const file = files[0]
    if (!file) return
    try {
      const parsed = parseRecord(await file.text())
      if (!parsed) throw new Error('無效的 JSON 格式')
      const next = fromStored(parsed)
      setConfig(next)
      setWidth(columnWidth(next.rows))
      setNotice({ tone: 'success', text: '已匯入' })
    } catch (error) {
      setNotice({ tone: 'danger', text: `匯入失敗：${messageOf(error)}` })
    }
  }

  const model: RowModel[] = config.rows.map((cells, index) => ({ index, cells }))
  const columns: TableColumn<RowModel>[] = Array.from({ length: columnCount }, (_, col) => ({
    key: `c${col}`,
    header: `參數${col + 1}`,
    render: (row) => (
      <Field
        label={`參數${col + 1}，第 ${row.index + 1} 列`}
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
        <h2>操作說明</h2>
        <ol className="batch-steps">
          <li>設置請求模板：選擇 GET 或 POST，輸入 URL 模板和（若為 POST）請求體模板，使用 {'{InputValue}'} 和 {'{ParameterX}'} 作為占位符。</li>
          <li>輸入主值：每行一個主值，每個主值會觸發一輪請求。</li>
          <li>設置參數組：每行一組參數，生成對應的請求。</li>
          <li>進階設置：調整請求間隔和授權選項。</li>
          <li>發送並查看結果：點擊發送後查看請求預覽和結果。</li>
        </ol>
        <div className="batch-actions">
          <Button variant="ghost" title="清空所有配置和數據" onClick={() => setConfirming(true)}>
            清空配置
          </Button>
          <Button
            variant="ghost"
            title="將當前配置匯出為 JSON 文件"
            onClick={() => {
              downloadFile(JSON.stringify(toStored(config), null, 2), `request-config-${dateStamp()}.json`, 'application/json')
              setNotice({ tone: 'success', text: '配置已匯出為 JSON 文件' })
            }}
          >
            匯出配置
          </Button>
          <FileInput label="匯入配置" accept=".json,application/json" hint="從 JSON 文件匯入配置" onFiles={(files) => void importConfig(files)} />
        </div>
      </section>

      <section className="batch-section">
        <h2>① 設置請求模板</h2>
        <Select
          label="請求方法"
          hint="選擇 HTTP 請求類型"
          value={config.method}
          options={[
            { value: 'GET', label: 'GET' },
            { value: 'POST', label: 'POST (JSON)' },
          ]}
          onChange={(event) => patch({ method: event.target.value === 'POST' ? 'POST' : 'GET' })}
        />
        <Field
          label="URL 模板"
          hint="使用 {InputValue} 和 {ParameterX} 作為動態占位符"
          value={config.urlTemplate}
          placeholder="例如: https://api.example.com/?id={InputValue}&key={Parameter1}"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => patch({ urlTemplate: event.target.value })}
        />
        {config.method === 'POST' ? (
          <TextArea
            label="POST 請求體模板"
            hint="輸入有效的 JSON 格式，使用 {InputValue} 和 {ParameterX} 替換"
            rows={4}
            value={config.postBody}
            placeholder='例如: {"id": "{InputValue}", "key": "{Parameter1}"}'
            spellCheck={false}
            onChange={(event) => patch({ postBody: event.target.value })}
          />
        ) : null}
        <Button variant="ghost" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}>
          進階設置
        </Button>
        {advanced ? (
          <>
            <Field
              label="每次請求間隔 (毫秒)"
              hint="設置為 0 表示無間隔，建議 500ms 或以上以避免過載"
              type="number"
              min={0}
              step={100}
              value={config.delay}
              onChange={(event) => patch({ delay: event.target.value })}
            />
            <Checkbox label="啟用 HTTP Authorization" checked={config.enableAuth} onChange={(event) => patch({ enableAuth: event.target.checked })} />
            <p className="batch-help">啟用後可設置認證頭。Basic 使用用戶名和密碼，Bearer 使用 Token。</p>
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
                    <Field label="用戶名" hint="用於 Basic 認證" value={config.authUsername} placeholder="輸入用戶名" autoComplete="off" onChange={(event) => patch({ authUsername: event.target.value })} />
                    <Field label="密碼" hint="用於 Basic 認證" type="password" value={config.authPassword} placeholder="輸入密碼" autoComplete="off" onChange={(event) => patch({ authPassword: event.target.value })} />
                  </>
                ) : (
                  <Field label="Bearer Token" hint="輸入完整的 Bearer Token" value={config.authToken} placeholder="輸入 API Token" autoComplete="off" spellCheck={false} onChange={(event) => patch({ authToken: event.target.value })} />
                )}
              </>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="batch-section">
        <h2>② 輸入主值（每個值發起一輪請求，每一輪有多組請求）</h2>
        <TextArea
          label="主值列表"
          hint="每個主值將觸發一輪請求"
          rows={4}
          value={config.inputValues}
          placeholder={'每行一個，例如：\nID1\nID2'}
          onChange={(event) => patch({ inputValues: event.target.value })}
        />
      </section>

      <section className="batch-section">
        <h2>③ 設置參數組（每組生成一個請求）</h2>
        <TextArea
          label="批量參數輸入"
          hint="每行一組參數，用空格分隔多項"
          rows={4}
          value={batchText}
          placeholder={'每行一組，例如：\nkey1 value1\nkey2 value2'}
          onChange={(event) => setBatchText(event.target.value)}
        />
        <div className="batch-actions">
          <Button title="將輸入的參數添加到表格" onClick={addBatch}>
            添加
          </Button>
          <Button variant="ghost" title="添加一行空的參數行" onClick={() => addRows([[]])}>
            加一行
          </Button>
          <Button
            variant="ghost"
            title="為表格添加一列"
            onClick={() => {
              const nextWidth = columnCount + 1
              setWidth(nextWidth)
              setConfig((prev) => ({ ...prev, rows: pad(prev.rows, nextWidth) }))
            }}
          >
            加一項
          </Button>
        </div>
        {columnCount > 0 ? (
          <div className="http-sheet">
            <Table label="參數組" columns={columns} rows={model} getRowKey={(row) => String(row.index)} />
          </div>
        ) : (
          <p className="batch-help">尚未加入參數組。</p>
        )}
      </section>

      <section className="batch-section">
        <h2>④ 生成並發送請求</h2>
        <div className="batch-actions">
          <Button title="發送所有生成的請求" disabled={running} onClick={() => void send()}>
            發送
          </Button>
          {running ? (
            <Button variant="danger" onClick={() => abortRef.current?.abort()}>
              停止
            </Button>
          ) : null}
        </div>
        <pre className="preview">{preview}</pre>
      </section>

      <section className="batch-section">
        <h2>⑤ 查看結果</h2>
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
        title="清空配置"
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
        <p>確定清空所有數據？</p>
      </Modal>
    </div>
  )
}
