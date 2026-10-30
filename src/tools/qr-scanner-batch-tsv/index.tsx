import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Banner, Button, FileInput } from '@/components/ui'
import { downloadFile, parseCsv, parseTsv, readXlsx, serializeTsv, type TableData } from '@/lib'
import './tool.css'
import { useLiveScan, type CameraPhase } from './useLiveScan'

const STORAGE_KEY = 'qr-scanner-batch-tsv:table'
const LEGACY_KEY = 'qrMappingTableData'
const PAUSE_MS = 500
const ACCEPT = '.txt,.tsv,.csv,.xlsx,.xls'

type Hit = { row: number; col: number; kind: 'match' | 'duplicate' }
type Point = { row: number; col: number }
type StorageState = 'saved' | 'loaded' | 'cleared' | 'error'
type LoadStatus = 'loaded' | 'empty' | 'invalid'
type Scan = {
  status: 'success' | 'fail'
  qr: string
  value: string
  time: string
  rowNumber: number | null
  colNumber: number | null
}

const STORAGE_LABEL: Record<StorageState, string> = {
  saved: '已儲存',
  loaded: '已載入',
  cleared: '已清除',
  error: '儲存失敗',
}

function blankGrid(): string[][] {
  return [['', '']]
}

function pad(rows: string[][], minCols: number): string[][] {
  const width = rows.reduce((max, row) => Math.max(max, row.length), minCols)
  return rows.map((row) => {
    const next = row.slice()
    while (next.length < width) next.push('')
    return next
  })
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function loadGrid(): { rows: string[][]; status: LoadStatus } {
  const blank = { rows: blankGrid(), status: 'empty' as const }
  try {
    const raw = readRaw(STORAGE_KEY) ?? readRaw(LEGACY_KEY)
    if (!raw) return blank
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return blank
    const rows: string[][] = []
    for (const row of parsed) {
      if (!Array.isArray(row)) return { rows: blankGrid(), status: 'invalid' }
      rows.push(row.map((cell) => (cell == null ? '' : String(cell).trim())))
    }
    return { rows: pad(rows, 2), status: 'loaded' }
  } catch {
    return { rows: blankGrid(), status: 'invalid' }
  }
}

function writeStore(matrix: string[][]): 'saved' | 'error' {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix))
    return 'saved'
  } catch {
    return 'error'
  }
}

function matrixFromTable(table: TableData): string[][] {
  if (table.headers.length === 0 && table.rows.length === 0) return []
  return [table.headers, ...table.rows].filter((row) => row.some((cell) => cell.trim() !== ''))
}

async function matrixFromFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return matrixFromTable(await readXlsx(file))
  const text = await file.text()
  if (name.endsWith('.csv')) return matrixFromTable(parseCsv(text))
  return matrixFromTable(parseTsv(text))
}

function pastedLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((line) => line.trim() !== '')
}

function pasteGrid(matrix: string[][], startRow: number, startCol: number, lines: string[]): string[][] {
  const next = matrix.map((row) => row.slice())
  if (next.length === 0) next.push(['', ''])
  const widthOf = () => next.reduce((max, row) => Math.max(max, row.length), 2)
  const ensureWidth = (needed: number) => {
    const target = Math.max(widthOf(), needed)
    for (const row of next) while (row.length < target) row.push('')
  }
  const ensureRow = (index: number) => {
    const cols = Math.max(widthOf(), 2)
    while (next.length <= index) next.push(Array.from({ length: cols }, () => ''))
  }
  lines.forEach((line, rowOffset) => {
    const cells = line.split('\t')
    const rowIndex = startRow + rowOffset
    ensureRow(rowIndex)
    cells.forEach((cell, colOffset) => {
      const colIndex = startCol + colOffset
      ensureWidth(colIndex + 1)
      const row = next[rowIndex]
      if (row) row[colIndex] = cell.trim()
    })
  })
  return next
}

function cameraLabel(phase: CameraPhase): string {
  if (phase === 'starting') return '正在啟動相機…'
  if (phase === 'live') return '相機已就緒'
  if (phase === 'error') return '相機啟動失敗'
  return '相機已停止'
}

function rowFlags(rowIndex: number, hits: Hit[]): string {
  const mine = hits.filter((hit) => hit.row === rowIndex)
  if (mine.length === 0) return ''
  const kinds = new Set(mine.map((hit) => hit.kind))
  if (kinds.has('match') && kinds.has('duplicate')) return 'is-match is-duplicate'
  if (kinds.has('duplicate')) return 'is-duplicate'
  if (kinds.has('match')) return 'is-match'
  return ''
}

export default function Tool() {
  const [boot] = useState(loadGrid)
  const [rows, setRows] = useState(boot.rows)
  const [selected, setSelected] = useState<Point | null>(null)
  const [hits, setHits] = useState<Hit[]>([])
  const [scan, setScan] = useState<Scan | null>(null)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [storage, setStorage] = useState<StorageState>(boot.status === 'loaded' ? 'loaded' : 'saved')
  const [notice, setNotice] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const rowEls = useRef(new Map<number, HTMLTableRowElement>())
  const pending = useRef<(Point & { select?: boolean }) | null>(null)
  const lock = useRef(false)
  const lockTimer = useRef(0)
  const lastScroll = useRef('')
  const onScanRef = useRef<(data: string) => void>(() => {})
  const colCount = rows[0]?.length ?? 2

  function pushLog(message: string) {
    const line = `${new Date().toLocaleTimeString()} ${message}`
    setLogs((prev) => [...prev, line].slice(-100))
  }

  function focusCell(row: number, col: number) {
    setSelected({ row, col })
    const el = inputs.current.get(`${row}:${col}`)
    if (el) {
      el.focus()
      pending.current = null
      return
    }
    pending.current = { row, col }
  }

  useEffect(() => {
    const target = pending.current
    if (!target) return
    const el = inputs.current.get(`${target.row}:${target.col}`)
    if (!el) return
    pending.current = null
    el.focus()
    setSelected({ row: target.row, col: target.col })
  }, [rows])

  useEffect(() => {
    const message =
      boot.status === 'invalid'
        ? '載入失敗'
        : boot.status === 'loaded'
          ? '頁面初始化完成，已載入先前的數據'
          : '頁面初始化完成，使用預設表格'
    const line = `${new Date().toLocaleTimeString()} ${message}`
    setLogs((prev) => [...prev, line].slice(-100))
  }, [boot.status])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = writeStore(rows)
      setStorage(result)
      if (result === 'error') {
        const line = `${new Date().toLocaleTimeString()} 儲存失敗`
        setLogs((prev) => [...prev, line].slice(-100))
      }
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [rows])

  useEffect(() => {
    return () => {
      window.clearTimeout(lockTimer.current)
      writeStore(rowsRef.current)
    }
  }, [])

  function updateCell(row: number, col: number, value: string) {
    setRows((prev) => prev.map((line, index) => (index === row ? line.map((cell, cellIndex) => (cellIndex === col ? value : cell)) : line)))
  }

  function addRow() {
    const index = rows.length
    setRows((prev) => {
      const width = Math.max(2, prev[0]?.length ?? 2)
      return [...prev, Array.from({ length: width }, () => '')]
    })
    pushLog(`新增行: ${index + 1}`)
  }

  function deleteRow() {
    if (rows.length <= 1) return
    const removed = rows.length - 1
    setRows((prev) => prev.slice(0, -1))
    setHits((prev) => prev.filter((hit) => hit.row !== removed))
    setSelected((prev) => (prev?.row === removed ? null : prev))
    pushLog('刪除最後一行')
  }

  function addColumn() {
    const next = colCount + 1
    setRows((prev) => prev.map((line) => [...line, '']))
    pushLog(`新增列: 對應值${next}`)
  }

  function deleteColumn() {
    if (colCount <= 2) return
    setRows((prev) => prev.map((line) => line.slice(0, -1)))
    setHits((prev) => prev.filter((hit) => hit.col < colCount - 1))
    setSelected((prev) => (prev && prev.col >= colCount - 1 ? null : prev))
    pushLog('刪除最後一列')
  }

  function clearTable() {
    setRows(blankGrid())
    setSelected(null)
    setHits([])
    setScan(null)
    setDuplicateCount(0)
    try {
      localStorage.removeItem(STORAGE_KEY)
      setStorage('cleared')
      pushLog('已清除本地儲存的表格數據')
    } catch (error) {
      const message = error instanceof Error ? error.message : '清除失敗'
      setStorage('error')
      pushLog(`清除本地儲存失敗: ${message}`)
    }
    pushLog('清空表格並還原預設')
  }

  function exportData() {
    const matrix = rowsRef.current
    const [headers, ...body] = matrix.length > 0 ? matrix : blankGrid()
    downloadFile(serializeTsv({ headers: headers ?? ['', ''], rows: body }), 'qr_mapping_data.tsv')
    pushLog('匯出數據完成')
  }

  async function onFiles(files: FileList) {
    const file = files[0]
    if (!file) return
    const name = file.name.toLowerCase()
    const excel = name.endsWith('.xlsx') || name.endsWith('.xls')
    try {
      const matrix = await matrixFromFile(file)
      if (matrix.length === 0) {
        const text = excel ? 'Excel文件為空或只包含空行' : '匯入文件為空或只包含空行'
        setNotice(text)
        pushLog(text)
        return
      }
      const width = matrix.reduce((max, row) => Math.max(max, row.length), 1)
      setRows(pad(matrix.map((row) => row.map((cell) => cell.trim())), width))
      setHits([])
      setSelected(null)
      setNotice(null)
      pushLog(`匯入${excel ? 'Excel' : '文字'}數據: ${matrix.length} 行`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '解析失敗'
      const text = `Excel文件解析失敗: ${message}`
      setNotice(text)
      pushLog(text)
    }
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.dataset.row == null) return
    const startRow = Number(target.dataset.row)
    const startCol = Number(target.dataset.col)
    if (!Number.isInteger(startRow) || !Number.isInteger(startCol)) return
    event.preventDefault()
    const lines = pastedLines(event.clipboardData.getData('text'))
    if (lines.length === 0) {
      setNotice('貼上數據為空或只包含空行')
      pushLog('貼上數據為空或只包含空行')
      return
    }
    setRows(pasteGrid(rowsRef.current, startRow, startCol, lines))
    pushLog(`貼上數據: ${lines.length} 行`)
  }

  function onToolKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.dataset.row == null) return
    const row = Number(target.dataset.row)
    const col = Number(target.dataset.col)
    if (!Number.isInteger(row) || !Number.isInteger(col)) return
    if (event.key === 'Escape') {
      target.blur()
      setSelected(null)
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      if (event.shiftKey) {
        if (col > 0) focusCell(row, col - 1)
        else if (row > 0) focusCell(row - 1, colCount - 1)
        return
      }
      if (col < colCount - 1) {
        focusCell(row, col + 1)
        return
      }
      setRows((prev) => prev.map((line) => [...line, '']))
      pending.current = { row, col: colCount }
      pushLog(`新增列: 對應值${colCount + 1}`)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (row < rows.length - 1) {
        focusCell(row + 1, col)
        return
      }
      const width = Math.max(2, colCount)
      setRows((prev) => [...prev, Array.from({ length: Math.max(2, prev[0]?.length ?? width) }, () => '')])
      pending.current = { row: rows.length, col }
      pushLog(`新增行: ${rows.length + 1}`)
      return
    }
    if (event.key === 'ArrowUp' && row > 0) {
      event.preventDefault()
      focusCell(row - 1, col)
    } else if (event.key === 'ArrowDown' && row < rows.length - 1) {
      event.preventDefault()
      focusCell(row + 1, col)
    } else if (event.key === 'ArrowLeft' && col > 0) {
      event.preventDefault()
      focusCell(row, col - 1)
    } else if (event.key === 'ArrowRight' && col < colCount - 1) {
      event.preventDefault()
      focusCell(row, col + 1)
    }
  }

  onScanRef.current = (data: string) => {
    const scanned = data.trim()
    if (!scanned || lock.current) return
    lock.current = true
    window.clearTimeout(lockTimer.current)
    lockTimer.current = window.setTimeout(() => {
      lock.current = false
    }, PAUSE_MS)

    const found: Array<{ row: number; col: number }> = []
    rowsRef.current.forEach((row, rowIndex) => {
      row.forEach((cell, col) => {
        if (cell.trim() === scanned) found.push({ row: rowIndex, col })
      })
    })
    const time = new Date().toLocaleTimeString()
    pushLog(`掃描到QR碼: "${scanned}"`)
    if (found.length === 0) {
      setDuplicateCount(0)
      setScan({ status: 'fail', qr: scanned, value: '未找到對應數據', time, rowNumber: null, colNumber: null })
      pushLog(`匹配失敗: 未找到 "${scanned}"`)
      return
    }
    const nextHits: Hit[] = found.map((hit, index) => ({
      ...hit,
      kind: index === 0 ? 'match' : 'duplicate',
    }))
    const first = nextHits[0]
    if (!first) return
    const value = (rowsRef.current[first.row]?.[first.col] ?? '').trim()
    setHits(nextHits)
    setDuplicateCount(found.length)
    setScan({
      status: 'success',
      qr: scanned,
      value,
      time,
      rowNumber: first.row + 1,
      colNumber: first.col + 1,
    })
    pushLog(`匹配成功: 找到${found.length}個匹配`)
    const token = `${first.row}:${first.col}:${scanned}`
    if (lastScroll.current !== token) {
      lastScroll.current = token
      const rowIndex = first.row
      requestAnimationFrame(() => {
        rowEls.current.get(rowIndex)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      })
    }
  }

  const camera = useLiveScan((data) => onScanRef.current(data))
  const scanTone = scan?.status === 'success' ? 'success' : scan?.status === 'fail' ? 'fail' : 'info'
  const scanLabel = scan?.status === 'success' ? '找到匹配' : scan?.status === 'fail' ? '未找到' : '掃描結果將顯示在這裡'

  return (
    <div className="qrb-root" onKeyDown={onToolKeyDown} onPaste={onPaste}>
      <section className="qrb-section" aria-label="掃描">
        <h2 className="qrb-title">掃描畫面與結果</h2>
        <div className="qrb-actions">
          <Button
            className="qrb-stop"
            variant={camera.phase === 'live' || camera.phase === 'starting' ? 'danger' : 'primary'}
            onClick={() => {
              if (camera.phase === 'live' || camera.phase === 'starting') camera.stop()
              else void camera.start()
            }}
          >
            {camera.phase === 'live' || camera.phase === 'starting' ? '停止掃描' : '開始掃描'}
          </Button>
          <div className="qrb-chips">
            <span className={`qrb-chip is-${camera.phase}`}>{cameraLabel(camera.phase)}</span>
            <span className={`qrb-chip is-${scanTone}`} role="status">
              {scanLabel}
            </span>
            {duplicateCount > 1 ? <span className="qrb-chip is-warn">重複 {duplicateCount} 個</span> : null}
          </div>
        </div>
        {camera.error ? <Banner tone="danger">{camera.error}</Banner> : null}
        <div className="qrb-split">
          <div className="qrb-stage">
            <video ref={camera.videoRef} className="qrb-video" muted playsInline autoPlay />
            <canvas ref={camera.canvasRef} className="qrb-canvas" aria-hidden />
          </div>
          <div className={`qrb-result${scan ? ` is-${scan.status}` : ''}`} aria-live="polite">
            <div className="qrb-result-head">
              <h3>當前掃描結果</h3>
              <Button
                variant="ghost"
                title="清空當前結果"
                onClick={() => {
                  setScan(null)
                  pushLog('已清空當前掃描結果')
                }}
              >
                清空結果
              </Button>
            </div>
            {scan ? (
              <>
                <p className="qrb-label">
                  內容: {scan.qr}
                  {scan.rowNumber && scan.colNumber ? ` (第${scan.rowNumber}行, 第${scan.colNumber}列)` : ''}
                </p>
                <p className="qrb-value">{scan.value}</p>
                <p className="qrb-time">掃描時間: {scan.time}</p>
              </>
            ) : (
              <p className="qrb-empty">掃描 QR 碼後將顯示對應參數</p>
            )}
          </div>
        </div>
      </section>

      <section className="qrb-section">
        <h2 className="qrb-title">數據表格</h2>
        {notice ? <Banner tone="warning">{notice}</Banner> : null}
        <div className="qrb-toolbar" role="group" aria-label="表格操作">
          <Button onClick={addRow}>新增行</Button>
          <Button variant="danger" onClick={deleteRow}>
            刪除行
          </Button>
          <Button onClick={addColumn}>新增列</Button>
          <Button variant="ghost" onClick={deleteColumn}>
            刪除列
          </Button>
          <Button variant="danger" onClick={clearTable}>
            清空表格
          </Button>
          <Button variant="ghost" onClick={exportData}>
            匯出數據
          </Button>
          <FileInput label="匯入數據" accept={ACCEPT} hint="支援 .txt、.tsv、.csv、.xlsx、.xls" onFiles={(files) => void onFiles(files)} />
        </div>
        <p className={`qrb-meta is-${storage}`}>
          數據行數: {rows.length} | 列數: {colCount} | {STORAGE_LABEL[storage]}
        </p>
        <p className="qrb-hint">
          匯入格式：TSV（Tab 分隔）、CSV（逗號分隔）、Excel（.xlsx / .xls）、TXT。在最後一列按 Tab 會新增一列，在最後一行按 Enter
          會新增一行。方向鍵在儲存格之間移動。
        </p>
        <div className="qrb-grid-wrap">
          <table className="qrb-grid">
            <caption className="sr-only">QR 對照表</caption>
            <thead>
              <tr>
                <th className="row-num" scope="col">
                  #
                </th>
                {Array.from({ length: colCount }, (_, col) => (
                  <th key={col} scope="col">
                    對應值{col + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  ref={(node) => {
                    if (node) rowEls.current.set(rowIndex, node)
                    else rowEls.current.delete(rowIndex)
                  }}
                  className={[selected?.row === rowIndex ? 'is-current' : '', rowFlags(rowIndex, hits)].filter(Boolean).join(' ')}
                >
                  <th className="row-num" scope="row">
                    {rowIndex + 1}
                  </th>
                  {Array.from({ length: colCount }, (_, col) => {
                    const hit = hits.find((item) => item.row === rowIndex && item.col === col)
                    const className = [
                      selected?.row === rowIndex && selected.col === col ? 'is-selected' : '',
                      hit?.kind === 'match' ? 'is-hit' : '',
                      hit?.kind === 'duplicate' ? 'is-dup' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <td key={col} className={className}>
                        <input
                          ref={(node) => {
                            const id = `${rowIndex}:${col}`
                            if (node) inputs.current.set(id, node)
                            else inputs.current.delete(id)
                          }}
                          type="text"
                          value={row[col] ?? ''}
                          placeholder="輸入數據"
                          aria-label={`對應值${col + 1} 第${rowIndex + 1}行`}
                          data-row={rowIndex}
                          data-col={col}
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          onChange={(event) => updateCell(rowIndex, col, event.target.value)}
                          onFocus={() => setSelected({ row: rowIndex, col })}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {logs.length > 0 ? (
        <section className="qrb-debug" aria-label="調試資訊">
          <div className="qrb-debug-head">
            <h2 className="qrb-title">調試資訊</h2>
            <Button variant="ghost" onClick={() => setLogs([])}>
              清空
            </Button>
          </div>
          <pre>{logs.join('\n')}</pre>
        </section>
      ) : null}
    </div>
  )
}
