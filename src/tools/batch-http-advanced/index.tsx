import { useEffect, useRef, useState } from 'react'
import { Clipboard, Trash2 } from 'lucide-react'
import {
  Banner,
  Button,
  Checkbox,
  Field,
  FileInput,
  IconButton,
  Modal,
  Select,
  TextArea,
} from '@/components/ui'
import { downloadFile, runHttpBatch, type HttpBatchRequest } from '@/lib'
import { dateStamp, downloadTable, readTableFile } from './files'
import { Sheet } from './sheet'
import './tool.css'

type Method = 'GET' | 'POST'
type AuthType = 'Basic' | 'Bearer'
type Notice = { tone: 'info' | 'success' | 'warning' | 'danger'; text: string } | null
type LogTone = 'ok' | 'bad' | 'pending'
type Cursor = { main: number; param: number }

type AdvancedConfig = {
  mainRows: string[][]
  paramRows: string[][]
  method: Method
  urlTemplate: string
  postBody: string
  delay: string
  enableAuth: boolean
  authType: AuthType
  authUsername: string
  authPassword: string
  authToken: string
}

type LogItem = {
  id: string
  title: string
  detail: string
  url: string
  body: string
  outcome: string
  full: string
  clipped: boolean
  expanded: boolean
  tone: LogTone
}

const STORAGE_KEY = 'batch-http-advanced:requestConfig'
const LEGACY_KEY = 'requestConfig'

function emptyGrid(): string[][] {
  return [['', '']]
}

function emptyConfig(): AdvancedConfig {
  return {
    mainRows: emptyGrid(),
    paramRows: emptyGrid(),
    method: 'GET',
    urlTemplate: '',
    postBody: '',
    delay: '3000',
    enableAuth: false,
    authType: 'Basic',
    authUsername: '',
    authPassword: '',
    authToken: '',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isAdvancedConfig(value: Record<string, unknown>) {
  return 'mainExcelData' in value || 'paramExcelData' in value || 'excelData' in value
}

function textOf(value: unknown, fallback = '') {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function gridOf(value: unknown): string[][] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const rows = value.map((row) => (Array.isArray(row) ? row.map((cell) => (cell == null ? '' : String(cell))) : []))
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (width === 0) return null
  return rows.map((row) => {
    const next = row.slice()
    while (next.length < width) next.push('')
    return next
  })
}

function fromStored(value: Record<string, unknown>): AdvancedConfig {
  const base = emptyConfig()
  return {
    ...base,
    mainRows: gridOf(value.mainExcelData) ?? emptyGrid(),
    paramRows: gridOf(value.paramExcelData) ?? gridOf(value.excelData) ?? emptyGrid(),
    method: value.method === 'POST' ? 'POST' : 'GET',
    urlTemplate: textOf(value.urlTemplate),
    postBody: textOf(value.postBody),
    delay: textOf(value.delay, '3000'),
    enableAuth: value.enableAuth === true,
    authType: value.authType === 'Bearer' ? 'Bearer' : 'Basic',
    authUsername: textOf(value.authUsername),
    authPassword: textOf(value.authPassword),
    authToken: textOf(value.authToken),
  }
}

function toStored(config: AdvancedConfig) {
  return {
    mainExcelData: config.mainRows,
    paramExcelData: config.paramRows,
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
  if (!parsed || !isAdvancedConfig(parsed)) return null
  return parsed
}

function removeLegacy() {
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (!legacy) return
  try {
    const parsed = parseRecord(legacy)
    if (parsed && isAdvancedConfig(parsed)) localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* 舊檔不是這個工具的配置 */
  }
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

function clipText(text: string, max: number) {
  if (text.length <= max) return { outcome: text, full: text, clipped: false }
  return { outcome: `${text.slice(0, max)} ... (點擊展開)`, full: text, clipped: true }
}

function describeOutcome(ok: boolean, status: number, bodyText: string, error: string | undefined) {
  if (error) return clipText(`失敗：${error}`, 100)
  if (ok) return clipText(`成功：${bodyText}`, 100)
  return clipText(`失敗（HTTP ${status}）：${bodyText}`, 100)
}

function resolveAuth(config: AdvancedConfig): { headers: Record<string, string> } | { error: string } {
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

function grow(rows: string[][], kind: 'row' | 'col') {
  if (rows.length === 0 || (rows[0]?.length ?? 0) === 0) return emptyGrid()
  if (kind === 'row') return [...rows, Array.from({ length: rows[0]?.length ?? 1 }, () => '')]
  return rows.map((row) => [...row, ''])
}

function shrink(rows: string[][], kind: 'row' | 'col', minColumns: number) {
  if (kind === 'row') return rows.length > 1 ? rows.slice(0, -1) : rows
  if ((rows[0]?.length ?? 0) <= minColumns) return rows
  return rows.map((row) => row.slice(0, -1))
}

export default function Tool() {
  const [config, setConfig] = useState(emptyConfig)
  const [advanced, setAdvanced] = useState(false)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const [animOn, setAnimOn] = useState(true)
  const [frame, setFrame] = useState({ main: 0, param: 0 })
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)
  const runningRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const stick = useRef(false)
  const totalRequests = config.mainRows.length * config.paramRows.length
  const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)
  const shown = animOn ? frame : { main: 0, param: 0 }

  useEffect(() => {
    try {
      const stored = readStored()
      if (stored) setConfig(fromStored(stored))
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
    if (!animOn) return
    const timer = window.setInterval(() => {
      setFrame((prev) => {
        const param = prev.param + 1
        if (param < 3) return { main: prev.main, param }
        return { main: (prev.main + 1) % 3, param: 0 }
      })
    }, 2000)
    return () => window.clearInterval(timer)
  }, [animOn])

  useEffect(() => {
    if (!autoScroll) return
    const node = logRef.current
    if (!node) return
    stick.current = true
    node.scrollTop = node.scrollHeight
    const timer = window.setTimeout(() => {
      stick.current = false
    }, 80)
    return () => window.clearTimeout(timer)
  }, [autoScroll, logs])

  useEffect(() => () => abortRef.current?.abort(), [])

  function patch(partial: Partial<AdvancedConfig>) {
    setConfig((prev) => ({ ...prev, ...partial }))
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

  async function importGrid(files: FileList, key: 'mainRows' | 'paramRows') {
    const file = files[0]
    if (!file) return
    try {
      const matrix = await readTableFile(file)
      if (matrix.length === 0) {
        setNotice({ tone: 'warning', text: '檔案沒有可匯入的資料' })
        return
      }
      patch({ [key]: matrix })
      setNotice({ tone: 'success', text: key === 'mainRows' ? '已匯入主項表格' : '已匯入參數組表格' })
    } catch (error) {
      setNotice({ tone: 'danger', text: `無法讀取檔案：${messageOf(error)}` })
    }
  }

  async function send() {
    if (runningRef.current) return
    if (config.mainRows.length === 0 || config.paramRows.length === 0) {
      setNotice({ tone: 'warning', text: '請設置主項表格和參數表格' })
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
    setCursor(null)
    const mainRows = config.mainRows
    const paramRows = config.paramRows
    const total = mainRows.length * paramRows.length
    setProgress({ done: 0, total })
    const delay = positiveDelay(config.delay)
    let sent = 0
    let halted = ''

    try {
      for (let i = 0; i < mainRows.length && !halted; i += 1) {
        const main = mainRows[i] ?? []
        const mainParams: Record<string, string> = {}
        main.forEach((value, index) => {
          mainParams[`MainItem${index + 1}`] = value
        })
        const mainLabel = main.map((item, index) => `主項${index + 1}: ${item}`).join(', ')
        for (let j = 0; j < paramRows.length; j += 1) {
          if (controller.signal.aborted) {
            halted = '已中止，其餘請求未發送'
            break
          }
          const param = paramRows[j] ?? []
          const params = { ...mainParams }
          param.forEach((value, index) => {
            params[`Parameter${index + 1}`] = value
          })
          setCursor({ main: i, param: j })
          const url = applyParams(config.urlTemplate, params, true)
          const id = `${i}-${j}`
          const paramLabel = param.map((item, index) => `參數${index + 1}: ${item}`).join(', ')
          const title = `請求 ${sent + 1}/${total}（外層 ${i + 1}，內層 ${j + 1}）`
          const detail = `主項: ${mainLabel} | 參數: ${paramLabel}`
          let body: string | undefined
          if (config.method === 'POST') {
            try {
              body = JSON.stringify(JSON.parse(applyParams(config.postBody, params, false)))
            } catch (error) {
              const clipped = clipText(`JSON 格式錯誤：${messageOf(error)}`, 100)
              putLog({ id, title, detail, url, body: '', ...clipped, expanded: false, tone: 'bad' })
              halted = 'JSON 格式錯誤，其後請求未發送'
              break
            }
          }
          putLog({
            id,
            title,
            detail,
            url,
            body: body ?? '',
            outcome: '發送中…',
            full: '發送中…',
            clipped: false,
            expanded: false,
            tone: 'pending',
          })
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
          putLog({ id, title, detail, url, body: body ?? '', ...described, expanded: false, tone: result?.ok ? 'ok' : 'bad' })
          sent += 1
          setProgress({ done: sent, total })
          if (controller.signal.aborted) {
            halted = '已中止，其餘請求未發送'
            break
          }
          if (delay > 0) await sleep(delay, controller.signal)
        }
      }
      if (halted) setNotice({ tone: 'warning', text: halted })
    } finally {
      setCursor(null)
      runningRef.current = false
      abortRef.current = null
      setRunning(false)
    }
  }

  async function copyResults() {
    const text = logs
      .map((item) => [item.title, item.detail, item.url, item.body, item.expanded ? item.full : item.outcome].filter(Boolean).join('\n'))
      .join('\n\n')
    if (!text.trim()) {
      setNotice({ tone: 'warning', text: '沒有可複製的結果' })
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setNotice({ tone: 'danger', text: '複製失敗' })
    }
  }

  function confirmClear() {
    abortRef.current?.abort()
    removeLegacy()
    setConfig(emptyConfig())
    setLogs([])
    setCursor(null)
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
      setConfig(fromStored(parsed))
      setNotice({ tone: 'success', text: '已匯入' })
    } catch (error) {
      setNotice({ tone: 'danger', text: `匯入失敗：${messageOf(error)}` })
    }
  }

  return (
    <div className="batch-tool">
      {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}

      <section className="batch-section">
        <div className="batch-actions">
          <FileInput label="匯入配置" accept=".json,application/json" hint="從 JSON 檔案匯入先前保存的配置" onFiles={(files) => void importConfig(files)} />
          <Button
            variant="ghost"
            title="將當前配置匯出為 JSON 檔案"
            onClick={() => {
              downloadFile(JSON.stringify(toStored(config), null, 2), `request-config-${dateStamp()}.json`, 'application/json')
              setNotice({ tone: 'success', text: '配置已匯出為 JSON 文件' })
            }}
          >
            匯出配置
          </Button>
          <Button variant="danger" title="清空所有表格和設定" onClick={() => setConfirming(true)}>
            清空
          </Button>
        </div>
      </section>

      <section className="batch-section">
        <h2>雙重循環示意圖</h2>
        <p className="batch-help">{animOn ? '點擊暫停動畫' : '點擊繼續動畫'}</p>
        <div className="loop-board">
          <div className="loop-col">
            <strong>外層循環（主項表格）</strong>
            {[0, 1, 2].map((index) => (
              <span key={index} className={animOn && shown.main === index ? 'loop-chip is-on' : 'loop-chip'}>
                主項行{index + 1}
              </span>
            ))}
          </div>
          <p className="loop-join">×</p>
          <div className="loop-col">
            <strong>內層循環（參數組表格）</strong>
            {[0, 1, 2].map((index) => (
              <span key={index} className={animOn && shown.param === index ? 'loop-chip is-on' : 'loop-chip'}>
                參數組{index + 1}
              </span>
            ))}
          </div>
          <p className="loop-join">＝</p>
          <div className="loop-col">
            <strong>生成請求</strong>
            {[0, 1, 2].map((index) => (
              <span key={index} className={animOn && shown.param === index ? 'loop-chip is-on' : 'loop-chip'}>
                請求{shown.main * 3 + index + 1}
              </span>
            ))}
          </div>
        </div>
        <p className="batch-help">總請求數 = 主項行數 × 參數組行數</p>
        <p className="batch-help" aria-live="polite">
          當前狀態：主項行{shown.main + 1} × 參數組{shown.param + 1} = 請求{shown.main * 3 + shown.param + 1}
        </p>
        <p className="batch-help">
          主項 <strong>{config.mainRows.length}</strong> 行 × 參數組 <strong>{config.paramRows.length}</strong> 行 = <strong>{totalRequests}</strong> 個請求
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            setAnimOn((value) => !value)
            setFrame({ main: 0, param: 0 })
          }}
        >
          {animOn ? '暫停動畫' : '繼續動畫'}
        </Button>
      </section>

      <section className="batch-section">
        <h2>① 設置主項表格（外層循環）</h2>
        <Banner tone="info">每一行主項都會觸發一輪完整的內層循環，與所有參數組進行組合。</Banner>
        <div className="batch-actions">
          <Button onClick={() => patch({ mainRows: grow(config.mainRows, 'row') })}>新增行</Button>
          <Button onClick={() => patch({ mainRows: grow(config.mainRows, 'col') })}>新增列</Button>
          <Button variant="ghost" onClick={() => patch({ mainRows: shrink(config.mainRows, 'row', 1) })} disabled={config.mainRows.length <= 1}>
            刪除行
          </Button>
          <Button variant="ghost" onClick={() => patch({ mainRows: shrink(config.mainRows, 'col', 1) })} disabled={(config.mainRows[0]?.length ?? 0) <= 1}>
            刪除列
          </Button>
          <Button variant="ghost" onClick={() => patch({ mainRows: emptyGrid() })}>
            清空表格
          </Button>
          <Button variant="ghost" title="匯出為 TSV 格式，可用 Excel 開啟" onClick={() => downloadTable(config.mainRows, `main-items-${dateStamp()}.tsv`)}>
            匯出 TSV
          </Button>
          <FileInput label="匯入 TSV" accept=".txt,.tsv,.csv,.xlsx,.xls" hint="支援 TSV、CSV、Excel（第一個工作表）" onFiles={(files) => void importGrid(files, 'mainRows')} />
        </div>
        <p className="batch-help">Tab 移到下一格，最右側會新增一列；Enter 移到下一列，最後一列會新增一行。可貼上以 Tab 分隔的儲存格。</p>
        <Sheet
          label="主項表格"
          rows={config.mainRows}
          columnName={(index) => `主項${index + 1}`}
          placeholder="輸入主項數據"
          activeRow={cursor?.main ?? null}
          scrollRow={cursor?.main ?? null}
          onRows={(mainRows) => patch({ mainRows })}
        />
      </section>

      <section className="batch-section">
        <h2>② 設置參數組表格（內層循環）</h2>
        <Banner tone="warning">每一行參數組都會與每一行主項進行組合，生成一個獨立的請求。</Banner>
        <div className="batch-actions">
          <Button onClick={() => patch({ paramRows: grow(config.paramRows, 'row') })}>新增行</Button>
          <Button onClick={() => patch({ paramRows: grow(config.paramRows, 'col') })}>新增列</Button>
          <Button variant="ghost" onClick={() => patch({ paramRows: shrink(config.paramRows, 'row', 1) })} disabled={config.paramRows.length <= 1}>
            刪除行
          </Button>
          <Button variant="ghost" onClick={() => patch({ paramRows: shrink(config.paramRows, 'col', 1) })} disabled={(config.paramRows[0]?.length ?? 0) <= 1}>
            刪除列
          </Button>
          <Button variant="ghost" onClick={() => patch({ paramRows: emptyGrid() })}>
            清空表格
          </Button>
          <Button variant="ghost" title="匯出為 TSV 格式，可用 Excel 開啟" onClick={() => downloadTable(config.paramRows, `params-${dateStamp()}.tsv`)}>
            匯出 TSV
          </Button>
          <FileInput label="匯入 TSV" accept=".txt,.tsv,.csv,.xlsx,.xls" hint="支援 TSV、CSV、Excel（第一個工作表）" onFiles={(files) => void importGrid(files, 'paramRows')} />
        </div>
        <Sheet
          label="參數組表格"
          rows={config.paramRows}
          columnName={(index) => `參數${index + 1}`}
          placeholder="輸入參數數據"
          activeRow={cursor?.param ?? null}
          scrollRow={cursor?.param ?? null}
          onRows={(paramRows) => patch({ paramRows })}
        />
      </section>

      <div className="batch-split">
        <section className="batch-section">
          <h2>③ 設置請求模板</h2>
          <Banner tone="info" title="佔位符對照">
            <p>{'{MainItem1}'}、{'{MainItem2}'} 對應主項表格第 1 列、第 2 列。</p>
            <p>{'{Parameter1}'}、{'{Parameter2}'} 對應參數組表格第 1 列、第 2 列。</p>
          </Banner>
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
            hint="在 URL 中使用上方的佔位符，系統會自動替換為表格中的實際數據"
            value={config.urlTemplate}
            placeholder="例如: https://api.example.com/?id={MainItem1}&key={Parameter1}"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => patch({ urlTemplate: event.target.value })}
          />
          {config.method === 'POST' ? (
            <TextArea
              label="POST 請求體模板"
              hint="輸入有效的 JSON 格式，使用上方的佔位符替換動態數據"
              rows={4}
              value={config.postBody}
              placeholder='例如: {"id": "{MainItem1}", "key": "{Parameter1}"}'
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
        </section>

        <section className="batch-section">
          <h2>④ 發送請求並查看結果</h2>
          <div className="batch-actions">
            <Button title="發送所有生成的請求" disabled={running} onClick={() => void send()}>
              開始發送
            </Button>
            {running ? (
              <Button variant="danger" onClick={() => abortRef.current?.abort()}>
                停止
              </Button>
            ) : null}
            <IconButton label={copied ? '已複製' : '複製所有請求結果'} title="複製所有請求結果" onClick={() => void copyResults()}>
              <Clipboard size={18} aria-hidden />
            </IconButton>
            <IconButton
              label="清空結果"
              title="清空結果"
              onClick={() => {
                setLogs([])
                setProgress({ done: 0, total: 0 })
              }}
            >
              <Trash2 size={18} aria-hidden />
            </IconButton>
            <Button
              variant="ghost"
              active={autoScroll}
              title={autoScroll ? '自動滾動開啟中（點擊暫停）' : '自動滾動已暫停（點擊開啟）'}
              onClick={() => setAutoScroll((value) => !value)}
            >
              {autoScroll ? '自動滾動' : '暫停滾動'}
            </Button>
          </div>
          <p className="batch-help">
            外層循環: {config.mainRows.length} 行主項 | 內層循環: {config.paramRows.length} 行參數 | 總請求數: {progress.done}/{progress.total || totalRequests}
          </p>
          <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="執行進度">
            <span style={{ width: `${percent}%` }} />
          </div>
          <div
            className="batch-log"
            ref={logRef}
            aria-live="polite"
            onScroll={() => {
              if (stick.current) return
              const node = logRef.current
              if (!node) return
              const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 8
              setAutoScroll((prev) => (prev === atBottom ? prev : atBottom))
            }}
          >
            {logs.length === 0 ? <p className="batch-help">尚無結果</p> : null}
            {logs.map((item) => (
              <article key={item.id} className={`batch-result batch-result--${item.tone}`}>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                {item.url ? <p className="batch-url">{item.url}</p> : null}
                {item.body ? <p className="batch-url">{item.body}</p> : null}
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
      </div>

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
