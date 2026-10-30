import { useEffect, useRef, useState } from 'react'
import {
  Banner,
  Button,
  Checkbox,
  Field,
  FileInput,
  Modal,
  Select,
  TextArea,
} from '@/components/ui'
import {
  attachCamera,
  downloadFile,
  runHttpBatch,
  startQrLoop,
  type HttpBatchRequest,
  type QrHit,
} from '@/lib'
import { downloadTable, readTableFile } from './files'
import { Sheet } from './sheet'
import './tool.css'

type Method = 'GET' | 'POST'
type AuthType = '' | 'bearer' | 'basic' | 'apikey'
type Notice = { tone: 'info' | 'success' | 'warning' | 'danger'; text: string } | null
type LogTone = 'ok' | 'bad' | 'pending'
type RowTone = 'matched' | 'duplicate'

type QrConfig = {
  rows: string[][]
  method: Method
  getUrl: string
  postUrl: string
  postBody: string
  removeRule: string
  addRule: string
  interval: string
  enableAuth: boolean
  authType: AuthType
  authToken: string
  authUsername: string
  authPassword: string
  apiKeyName: string
  apiKeyValue: string
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

const STORAGE_KEY = 'qrScannerConfig'
const SAMPLE_BODY = `{
    "CmdCode": "{Parameter1}",
    "Params": "{Parameter2}",
    "IMEI": "{Parameter_qrcode}",
    "CheckCode": "{Parameter3}"
}`
const CAMERA = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  focusMode: 'continuous',
  zoom: { ideal: 1.5 },
  focusDistance: { ideal: 0.3 },
} as MediaTrackConstraints

function emptyGrid(): string[][] {
  return [['', '']]
}

function freshConfig(): QrConfig {
  return {
    rows: emptyGrid(),
    method: 'GET',
    getUrl: '',
    postUrl: '',
    postBody: SAMPLE_BODY,
    removeRule: 'IMEI=',
    addRule: '',
    interval: '3000',
    enableAuth: false,
    authType: '',
    authToken: '',
    authUsername: '',
    authPassword: '',
    apiKeyName: '',
    apiKeyValue: '',
  }
}

function clearedConfig(): QrConfig {
  return { ...freshConfig(), postBody: '' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
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

function authTypeOf(value: unknown): AuthType {
  if (value === 'bearer' || value === 'basic' || value === 'apikey') return value
  return ''
}

function fromStored(value: Record<string, unknown>): QrConfig {
  const base = clearedConfig()
  const auth = isRecord(value.authConfig) ? value.authConfig : null
  const enabled = value.enableAuth === true
  const authType = enabled ? authTypeOf(auth?.type) : ''
  return {
    ...base,
    rows: gridOf(value.excelData) ?? emptyGrid(),
    method: value.requestMethod === 'POST' ? 'POST' : 'GET',
    getUrl: textOf(value.getUrlTemplate),
    postUrl: textOf(value.postUrlTemplate),
    postBody: textOf(value.postBodyTemplate),
    removeRule: textOf(value.qrcodePreModifyRemove) || 'IMEI=',
    addRule: textOf(value.qrcodePreModifyAdd),
    interval: textOf(value.requestInterval) || '3000',
    enableAuth: enabled,
    authType,
    authToken: authType === 'bearer' ? textOf(auth?.token) : '',
    authUsername: authType === 'basic' ? textOf(auth?.username) : '',
    authPassword: authType === 'basic' ? textOf(auth?.password) : '',
    apiKeyName: authType === 'apikey' ? textOf(auth?.keyName) : '',
    apiKeyValue: authType === 'apikey' ? textOf(auth?.keyValue) : '',
  }
}

function toStored(config: QrConfig) {
  let authConfig: Record<string, string> | null = null
  if (config.enableAuth) {
    if (config.authType === 'bearer') authConfig = { type: 'bearer', token: config.authToken }
    else if (config.authType === 'basic') authConfig = { type: 'basic', username: config.authUsername, password: config.authPassword }
    else if (config.authType === 'apikey') authConfig = { type: 'apikey', keyName: config.apiKeyName, keyValue: config.apiKeyValue }
    else authConfig = { type: '' }
  }
  return {
    excelData: config.rows,
    requestMethod: config.method,
    getUrlTemplate: config.getUrl,
    postUrlTemplate: config.postUrl,
    postBodyTemplate: config.postBody,
    qrcodePreModifyRemove: config.removeRule,
    qrcodePreModifyAdd: config.addRule,
    requestInterval: config.interval,
    enableAuth: config.enableAuth,
    authConfig,
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

function preModify(qr: string, removeRule: string, addRule: string) {
  let value = qr
  if (removeRule) value = value.replace(removeRule, '')
  if (addRule) value = addRule + value
  return value
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

function buildAuth(config: QrConfig): Record<string, string> {
  if (!config.enableAuth) return {}
  if (config.authType === 'bearer') {
    const token = config.authToken.trim()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
  if (config.authType === 'basic') {
    const username = config.authUsername.trim()
    const password = config.authPassword.trim()
    if (!username || !password) return {}
    return { Authorization: `Basic ${btoa(`${username}:${password}`)}` }
  }
  if (config.authType === 'apikey') {
    const name = config.apiKeyName.trim()
    const value = config.apiKeyValue.trim()
    if (!name || !value) return {}
    return { [name]: value }
  }
  return {}
}

function grow(rows: string[][], kind: 'row' | 'col') {
  if (rows.length === 0 || (rows[0]?.length ?? 0) === 0) return emptyGrid()
  if (kind === 'row') return [...rows, Array.from({ length: rows[0]?.length ?? 1 }, () => '')]
  return rows.map((row) => [...row, ''])
}

function shrink(rows: string[][], kind: 'row' | 'col') {
  if (kind === 'row') return rows.length > 1 ? rows.slice(0, -1) : rows
  if ((rows[0]?.length ?? 0) <= 2) return rows
  return rows.map((row) => row.slice(0, -1))
}

export default function Tool() {
  const [config, setConfig] = useState(freshConfig)
  const [advanced, setAdvanced] = useState(false)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirming, setConfirming] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [tones, setTones] = useState<Record<number, RowTone>>({})
  const [currentRow, setCurrentRow] = useState<number | null>(null)
  const [scrollRow, setScrollRow] = useState<number | null>(null)
  const [scanText, setScanText] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [cameraError, setCameraError] = useState('')
  const [cameraAttempt, setCameraAttempt] = useState(0)
  const configRef = useRef(config)
  const aliveRef = useRef(true)
  const busyRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const onHitRef = useRef<(hit: QrHit) => void>(() => {})
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const stick = useRef(false)
  configRef.current = config
  const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)

  function patch(partial: Partial<QrConfig>) {
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

  async function handleScan(raw: string) {
    let resumeIn = 500
    const controller = new AbortController()
    try {
      const current = configRef.current
      const qr = preModify(raw, current.removeRule.trim(), current.addRule.trim())
      if (!qr.trim()) return
      const sourceRows = current.rows
      if (sourceRows.length === 0 || (sourceRows.length === 1 && (sourceRows[0] ?? []).every((cell) => !cell))) {
        resumeIn = 1000
        if (aliveRef.current) setNotice({ tone: 'warning', text: '表格中無數據，請先添加參數' })
        return
      }

      resumeIn = 3000
      const matched: number[] = []
      sourceRows.forEach((row, index) => {
        if (row.some((cell) => cell === qr)) matched.push(index)
      })
      const nextTones: Record<number, RowTone> = {}
      matched.forEach((row, index) => {
        if (nextTones[row]) return
        nextTones[row] = index === 0 ? 'matched' : 'duplicate'
      })
      if (aliveRef.current) {
        setTones(nextTones)
        setScanText(qr)
        setLogs([])
        setRequesting(true)
        setNotice({
          tone: 'info',
          text:
            matched.length > 0
              ? `已填入 Parameter_qrcode，並比對到 ${matched.length} 列。仍會對每一列各發一次請求。`
              : '已填入 Parameter_qrcode。表格中沒有相同儲存格，仍會對每一列發送。',
        })
        const first = matched[0]
        if (first != null) setScrollRow(first)
      }

      abortRef.current = controller
      const method = current.method
      const wait = positiveDelay(current.interval)
      let auth: Record<string, string>
      try {
        auth = buildAuth(current)
      } catch {
        if (aliveRef.current) setNotice({ tone: 'danger', text: 'Basic Auth 只能使用 Latin-1 字元' })
        return
      }
      const total = sourceRows.length
      if (aliveRef.current) setProgress({ done: 0, total })
      let stopped = false

      for (let i = 0; i < total; i += 1) {
        if (controller.signal.aborted || !aliveRef.current) {
          stopped = true
          break
        }
        await sleep(wait * i, controller.signal)
        if (controller.signal.aborted || !aliveRef.current) {
          stopped = true
          break
        }
        const row = configRef.current.rows[i] ?? sourceRows[i] ?? []
        const params: Record<string, string> = { Parameter_qrcode: qr }
        row.forEach((value, index) => {
          params[`Parameter${index + 1}`] = value || ''
        })
        if (aliveRef.current) {
          setCurrentRow(i)
          setScrollRow(i)
          window.setTimeout(() => {
            if (!aliveRef.current) return
            setCurrentRow((prev) => (prev === i ? null : prev))
          }, 1000)
        }
        const id = `${Date.now()}-${i}`
        const title = `請求 ${i + 1}/${total}`
        const detail = `Parameter_qrcode＝${qr}`
        const live = configRef.current
        const url = applyParams(method === 'GET' ? live.getUrl : live.postUrl, params, true)
        let body: string | undefined
        if (method === 'POST') {
          const filled = applyParams(live.postBody.trim(), params, false).replace(/,\s*}/g, '}').replace(/\s+/g, ' ')
          try {
            body = JSON.stringify(JSON.parse(filled))
          } catch (error) {
            const clipped = clipText(`JSON 格式錯誤: ${messageOf(error)}`, 100)
            putLog({ id, title, detail: `${detail}\n${url}`, ...clipped, expanded: false, tone: 'bad' })
            if (aliveRef.current) setProgress({ done: i + 1, total })
            continue
          }
        }
        putLog({ id, title, detail: `${detail}\n${url}`, outcome: '發送中…', full: '發送中…', clipped: false, expanded: false, tone: 'pending' })
        const headers = { ...auth }
        if (method === 'POST') headers['Content-Type'] = 'application/json'
        const request: HttpBatchRequest = {
          method,
          url,
          headers,
          ...(body !== undefined ? { body } : {}),
        }
        const [result] = await runHttpBatch([request], { concurrency: 1, signal: controller.signal })
        const described = describeOutcome(result?.ok ?? false, result?.status ?? 0, result?.bodyText ?? '', result?.error)
        putLog({ id, title, detail: `${detail}\n${url}`, ...described, expanded: false, tone: result?.ok ? 'ok' : 'bad' })
        if (aliveRef.current) setProgress({ done: i + 1, total })
        if (controller.signal.aborted) {
          stopped = true
          break
        }
      }
      if (stopped && aliveRef.current) setNotice({ tone: 'warning', text: '請求已停止' })
    } catch (error) {
      if (aliveRef.current) setNotice({ tone: 'danger', text: messageOf(error) })
    } finally {
      abortRef.current = null
      if (aliveRef.current) {
        setRequesting(false)
        setCurrentRow(null)
      }
      window.setTimeout(() => {
        busyRef.current = false
      }, resumeIn)
    }
  }

  onHitRef.current = (hit) => {
    if (busyRef.current) return
    if (!hit.data.trim()) return
    busyRef.current = true
    void handleScan(hit.data)
  }

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
    let active = true
    let stop: (() => void) | null = null
    void (async () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      try {
        const release = await attachCamera(video, CAMERA)
        if (!active) {
          release()
          return
        }
        try {
          const stopLoop = startQrLoop(video, canvas, (hit) => onHitRef.current(hit))
          stop = () => {
            stopLoop()
            release()
          }
        } catch (error) {
          release()
          throw error
        }
        if (active) setCameraError('')
      } catch (error) {
        if (!active) return
        setCameraError(messageOf(error) || '無法啟動攝像頭，請檢查權限或設備')
      }
    })()
    return () => {
      active = false
      stop?.()
    }
  }, [cameraAttempt])

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

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  function confirmClear() {
    abortRef.current?.abort()
    localStorage.removeItem(STORAGE_KEY)
    setConfig(clearedConfig())
    setLogs([])
    setTones({})
    setScanText('')
    setCurrentRow(null)
    setScrollRow(null)
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

  async function importTable(files: FileList) {
    const file = files[0]
    if (!file) return
    try {
      const matrix = await readTableFile(file)
      if (matrix.length === 0) {
        setNotice({ tone: 'warning', text: '檔案沒有可匯入的資料' })
        return
      }
      patch({ rows: matrix })
      setNotice({ tone: 'success', text: '已匯入參數表' })
    } catch (error) {
      setNotice({ tone: 'danger', text: `無法讀取檔案：${messageOf(error)}` })
    }
  }

  return (
    <div className="batch-tool">
      {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
      {cameraError ? (
        <Banner tone="danger" title="無法啟動攝像頭">
          {cameraError}。請檢查權限或設備。
        </Banner>
      ) : null}

      <section className="batch-section">
        <h2>請求配置</h2>
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
            hint="使用 {Parameter1}、{Parameter_qrcode} 等"
            value={config.getUrl}
            placeholder="例如: https://api.example.com/check?qr={Parameter_qrcode}&p1={Parameter1}"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => patch({ getUrl: event.target.value })}
          />
        ) : (
          <>
            <Field
              label="POST URL 模板"
              hint="使用 {Parameter1}、{Parameter_qrcode} 等"
              value={config.postUrl}
              placeholder="例如: https://api.example.com/submit"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => patch({ postUrl: event.target.value })}
            />
            <TextArea
              label="POST JSON 模板"
              hint="使用 {Parameter1}、{Parameter_qrcode} 等"
              rows={6}
              value={config.postBody}
              spellCheck={false}
              onChange={(event) => patch({ postBody: event.target.value })}
            />
          </>
        )}
        <Checkbox label="啟用 Authorization" checked={config.enableAuth} onChange={(event) => patch({ enableAuth: event.target.checked })} />
        {config.enableAuth ? (
          <>
            <Select
              label="選擇授權類型"
              value={config.authType}
              options={[
                { value: '', label: '-- 選擇授權方式 --' },
                { value: 'bearer', label: 'Bearer Token' },
                { value: 'basic', label: 'Basic Authentication' },
                { value: 'apikey', label: 'API Key' },
              ]}
              onChange={(event) => patch({ authType: authTypeOf(event.target.value) })}
            />
            {config.authType === 'bearer' ? (
              <Field label="Bearer Token" value={config.authToken} placeholder="輸入您的 Bearer Token" autoComplete="off" spellCheck={false} onChange={(event) => patch({ authToken: event.target.value })} />
            ) : null}
            {config.authType === 'basic' ? (
              <>
                <Field label="用戶名" value={config.authUsername} placeholder="用戶名" autoComplete="off" onChange={(event) => patch({ authUsername: event.target.value })} />
                <Field label="密碼" type="password" value={config.authPassword} placeholder="密碼" autoComplete="off" onChange={(event) => patch({ authPassword: event.target.value })} />
              </>
            ) : null}
            {config.authType === 'apikey' ? (
              <>
                <Field label="API Key 名稱" value={config.apiKeyName} placeholder="例如: X-API-KEY" autoComplete="off" onChange={(event) => patch({ apiKeyName: event.target.value })} />
                <Field label="API Key 值" value={config.apiKeyValue} placeholder="輸入您的 API Key" autoComplete="off" spellCheck={false} onChange={(event) => patch({ apiKeyValue: event.target.value })} />
              </>
            ) : null}
          </>
        ) : null}
        <Button variant="ghost" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}>
          進階設置
        </Button>
        {advanced ? (
          <>
            <Field
              label="Parameter_qrcode 預移除字眼"
              hint="輸入要移除的字眼，或留空不移除"
              value={config.removeRule}
              placeholder="例如: 移除 IMEI= (輸入 IMEI=)"
              autoComplete="off"
              onChange={(event) => patch({ removeRule: event.target.value })}
            />
            <Field
              label="Parameter_qrcode 預新增字眼"
              hint="輸入要加入的前綴，或留空不新增"
              value={config.addRule}
              placeholder="例如: 加入 ID= (輸入 ID=)"
              autoComplete="off"
              onChange={(event) => patch({ addRule: event.target.value })}
            />
            <Field
              label="每次請求間隔 (毫秒)"
              hint="設置為 0 表示無間隔，建議 500ms 或以上"
              type="number"
              min={0}
              step={100}
              value={config.interval}
              onChange={(event) => patch({ interval: event.target.value })}
            />
          </>
        ) : null}
        <div className="batch-actions">
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            清空儲存
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              downloadFile(JSON.stringify(toStored(config), null, 2), `qr-scanner-config-${dateStamp()}.json`, 'application/json')
              setNotice({ tone: 'success', text: '配置已匯出為 JSON 文件' })
            }}
          >
            匯出配置
          </Button>
          <FileInput label="匯入配置" accept=".json,application/json" onFiles={(files) => void importConfig(files)} />
        </div>
      </section>

      <section className="batch-section">
        <h2>參數管理</h2>
        <p className="batch-help">匯入格式：TSV（Tab 分隔）、CSV（逗號分隔）、Excel（.xlsx / .xls，第一個工作表）。匯出格式：TSV。掃描到的內容會先套用預移除／預新增，再填入每個請求的 {'{Parameter_qrcode}'}。</p>
        <div className="batch-actions">
          <Button onClick={() => patch({ rows: grow(config.rows, 'row') })}>新增行</Button>
          <Button onClick={() => patch({ rows: grow(config.rows, 'col') })}>新增列</Button>
          <Button variant="ghost" onClick={() => patch({ rows: shrink(config.rows, 'row') })} disabled={config.rows.length <= 1}>
            刪除行
          </Button>
          <Button variant="ghost" onClick={() => patch({ rows: shrink(config.rows, 'col') })} disabled={(config.rows[0]?.length ?? 0) <= 2}>
            刪除列
          </Button>
          <Button variant="ghost" onClick={() => patch({ rows: emptyGrid() })}>
            清空表格
          </Button>
          <Button variant="ghost" title="匯出為 TSV 格式，可用 Excel 開啟" onClick={() => downloadTable(config.rows, 'params.tsv')}>
            匯出 TSV
          </Button>
          <FileInput label="匯入" accept=".txt,.tsv,.csv,.xlsx,.xls" hint="支援 TSV、CSV、Excel" onFiles={(files) => void importTable(files)} />
        </div>
        <Sheet
          label="參數表"
          rows={config.rows}
          columnName={(index) => `對應值${index + 1}`}
          placeholder="輸入數據"
          activeRow={currentRow}
          scrollRow={scrollRow}
          tabWrap
          rowClassName={(row) => {
            const tone = tones[row]
            const match = tone === 'matched' ? 'is-matched' : tone === 'duplicate' ? 'is-duplicate' : ''
            const current = currentRow === row ? 'is-current' : ''
            const joined = [match, current].filter(Boolean).join(' ')
            return joined || undefined
          }}
          onRows={(rows) => patch({ rows })}
        />
      </section>

      <section className="batch-section">
        <h2>攝像頭預覽與請求狀態</h2>
        <div className="batch-split">
          <div className="qr-stage">
            <video ref={videoRef} className="qr-video" muted playsInline aria-label="攝像頭預覽" />
            <canvas ref={canvasRef} className="qr-canvas" aria-hidden />
            {cameraError ? (
              <Button onClick={() => setCameraAttempt((value) => value + 1)}>重新開啟攝像頭</Button>
            ) : (
              <p className="batch-help">請將 QR 碼對準攝像頭。掃到後會暫停掃描，送完這一輪再繼續。</p>
            )}
          </div>
          <div>
            <div className="batch-actions">
              <Button variant="ghost" active={autoScroll} title="自動滾動" onClick={() => setAutoScroll((value) => !value)}>
                {autoScroll ? '自動滾動' : '停止滾動'}
              </Button>
              {requesting ? (
                <Button variant="danger" onClick={() => abortRef.current?.abort()}>
                  停止請求
                </Button>
              ) : null}
            </div>
            {scanText ? <p className="batch-help">本次 Parameter_qrcode：{scanText}</p> : null}
            <p className="batch-help">
              已完成 {progress.done}/{progress.total}
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
              {logs.length === 0 ? <p className="batch-help">請將 QR 碼對準攝像頭進行掃描</p> : null}
              {logs.map((item) => (
                <article key={item.id} className={`batch-result batch-result--${item.tone}`}>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
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
          </div>
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
