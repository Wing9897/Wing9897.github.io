import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Banner, Button, FileInput } from '@/components/ui'
import { downloadFile, parseCsv, parseTsv, readXlsx, serializeTsv, type TableData } from '@/lib'
import './tool.css'
import { useLiveScan, type CameraPhase } from './useLiveScan'

const STORAGE_KEY = 'qr-scanner-keyvalue:table'
const LEGACY_KEY = 'qrMappingTableData'
const PAUSE_MS = 500
const HEADERS = ['QR碼 (Key)', '對應參數 (Value)']
const PLACEHOLDERS = ['輸入QR碼', '輸入對應參數']
const ACCEPT = '.txt,.tsv,.csv,.xlsx,.xls'

type Hit = { row: number; col: number; kind: 'match' | 'duplicate' }
type Point = { row: number; col: number }
type StorageState = 'saved' | 'loaded' | 'cleared' | 'error'
type LoadStatus = 'loaded' | 'empty' | 'invalid'
type Scan = {
  status: 'success' | 'fail'
  qr: string
  parameter: string
  time: string
  rowNumber: number | null
}

const STORAGE_LABEL: Record<StorageState, string> = {
  saved: '已儲存',
  loaded: '已載入',
  cleared: '已清除',
  error: '儲存失敗',
}

function emptyRow(): string[] {
  return ['', '']
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function loadPairs(): { rows: string[][]; status: LoadStatus } {
  const blank = { rows: [emptyRow()], status: 'empty' as const }
  try {
    const raw = readRaw(STORAGE_KEY) ?? readRaw(LEGACY_KEY)
    if (!raw) return blank
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return blank
    const rows: string[][] = []
    for (const row of parsed) {
      if (!Array.isArray(row)) return { rows: [emptyRow()], status: 'invalid' }
      const key = row[0] == null ? '' : String(row[0]).trim()
      const value = row[1] == null ? '' : String(row[1]).trim()
      rows.push([key, value])
    }
    return { rows, status: 'loaded' }
  } catch {
    return { rows: [emptyRow()], status: 'invalid' }
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

function pastePairs(matrix: string[][], startRow: number, lines: string[]): string[][] {
  const next = matrix.map((row) => [row[0] ?? '', row[1] ?? ''])
  lines.forEach((line, offset) => {
    const cells = line.split('\t')
    const index = startRow + offset
    while (next.length <= index) next.push(emptyRow())
    next[index] = [(cells[0] ?? '').trim(), (cells[1] ?? '').trim()]
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
  const [boot] = useState(loadPairs)
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

  function pushLog(message: string) {
    const line = `${new Date().toLocaleTimeString()} ${message}`
    setLogs((prev) => [...prev, line].slice(-100))
  }

  function focusCell(row: number, col: number, select = false) {
    setSelected({ row, col })
    const el = inputs.current.get(`${row}:${col}`)
    if (el) {
      el.focus()
      if (select) el.select()
      pending.current = null
      return
    }
    pending.current = { row, col, select }
  }

  useEffect(() => {
    const target = pending.current
    if (!target) return
    const el = inputs.current.get(`${target.row}:${target.col}`)
    if (!el) return
    pending.current = null
    el.focus()
    if (target.select) el.select()
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
    setRows((prev) => [...prev, emptyRow()])
    pending.current = { row: index, col: 0 }
    setNotice(null)
    pushLog(`新增行: ${index + 1}`)
  }

  function deleteRow() {
    if (rows.length <= 1) return
    if (selected && selected.row >= 0 && selected.row < rows.length) {
      const removed = selected.row
      setRows((prev) => prev.filter((_, index) => index !== removed))
      setHits((prev) =>
        prev.filter((hit) => hit.row !== removed).map((hit) => (hit.row > removed ? { ...hit, row: hit.row - 1 } : hit)),
      )
      setSelected(null)
      pushLog(`刪除第${removed + 1}行`)
      return
    }
    const removed = rows.length - 1
    setRows((prev) => prev.slice(0, -1))
    setHits((prev) => prev.filter((hit) => hit.row !== removed))
    pushLog('刪除最後一行')
  }

  function rejectColumn() {
    const text = '鍵值模式下保持固定兩列：QR碼 (Key) 和 對應參數 (Value)'
    setNotice(text)
    pushLog('鍵值模式下保持固定兩列，無法變更列數')
  }

  function clearTable() {
    setRows([emptyRow()])
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

  function selectAll() {
    if (rows.length === 0) return
    focusCell(0, 0, true)
    pushLog('已全選表格數據')
  }

  function duplicateSelected() {
    if (!selected || !rows[selected.row]) {
      setNotice('請先選擇要複製的行')
      pushLog('請先選擇要複製的行')
      return
    }
    const source = rows[selected.row]
    const index = rows.length
    setRows((prev) => [...prev, [source?.[0] ?? '', source?.[1] ?? '']])
    pending.current = { row: index, col: 0 }
    pushLog(`複製第${selected.row + 1}行數據`)
  }

  function exportData() {
    const matrix = rowsRef.current
    const [headers, ...body] = matrix.length > 0 ? matrix : [emptyRow()]
    downloadFile(serializeTsv({ headers: headers ?? emptyRow(), rows: body }), 'qr_mapping_data.tsv')
    pushLog('匯出數據完成')
  }

  function saveNow() {
    const result = writeStore(rowsRef.current)
    setStorage(result)
    if (result === 'error') pushLog('儲存失敗')
    else pushLog('表格數據已寫入本地儲存')
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
      setRows(matrix.map((row) => [(row[0] ?? '').trim(), (row[1] ?? '').trim()]))
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
    setRows(pastePairs(rowsRef.current, startRow, lines))
    pushLog(`貼上數據: ${lines.length} 行`)
  }

  function onCopy(event: ClipboardEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.dataset.row == null) return
    event.preventDefault()
    event.clipboardData.setData('text/plain', target.value)
    pushLog(`已複製: "${target.value}"`)
  }

  function onToolKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target
    const gridInput = target instanceof HTMLInputElement && target.dataset.row != null ? target : null
    const key = event.key.toLowerCase()

    if ((event.ctrlKey || event.metaKey) && key === 's') {
      event.preventDefault()
      saveNow()
      return
    }
    if ((event.ctrlKey || event.metaKey) && key === 'n') {
      event.preventDefault()
      addRow()
      return
    }
    if ((event.ctrlKey || event.metaKey) && key === 'a' && gridInput) {
      event.preventDefault()
      gridInput.select()
      return
    }
    if (!gridInput && event.key === 'Delete' && !selected) {
      event.preventDefault()
      deleteRow()
      return
    }
    if (!gridInput) return

    const row = Number(gridInput.dataset.row)
    const col = Number(gridInput.dataset.col)
    if (!Number.isInteger(row) || !Number.isInteger(col)) return

    if ((event.key === 'Delete' || event.key === 'Backspace') && gridInput.value === '') {
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') {
      gridInput.blur()
      setSelected(null)
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      if (event.shiftKey) {
        if (col > 0) focusCell(row, col - 1)
        else if (row > 0) focusCell(row - 1, 1)
        return
      }
      if (col < 1) {
        focusCell(row, col + 1)
        return
      }
      if (row < rows.length - 1) {
        focusCell(row + 1, 0)
        return
      }
      setRows((prev) => [...prev, emptyRow()])
      pending.current = { row: rows.length, col: 0 }
      pushLog(`新增行: ${rows.length + 1}`)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) {
        if (row > 0) focusCell(row - 1, col)
        return
      }
      if (row < rows.length - 1) {
        focusCell(row + 1, col)
        return
      }
      setRows((prev) => [...prev, emptyRow()])
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
    } else if (event.key === 'ArrowRight' && col < 1) {
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
      if ((row[0] ?? '').trim() === scanned) found.push({ row: rowIndex, col: 0 })
    })
    const time = new Date().toLocaleTimeString()
    pushLog(`掃描到QR碼: "${scanned}"`)
    if (found.length === 0) {
      setDuplicateCount(0)
      setScan({ status: 'fail', qr: scanned, parameter: '未找到對應參數', time, rowNumber: null })
      pushLog(`匹配失敗: 未找到 "${scanned}"`)
      return
    }
    const nextHits: Hit[] = found.map((hit, index) => ({
      ...hit,
      kind: index === 0 ? 'match' : 'duplicate',
    }))
    const first = nextHits[0]
    if (!first) return
    const parameter = (rowsRef.current[first.row]?.[1] ?? '').trim() || '無對應參數'
    setHits(nextHits)
    setDuplicateCount(found.length)
    setScan({ status: 'success', qr: scanned, parameter, time, rowNumber: first.row + 1 })
    pushLog(`匹配成功: 找到${found.length}個匹配，顯示第${first.row + 1}行`)
    const token = `${first.row}:${scanned}`
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
  const scanLabel = scan?.status === 'success' && scan.rowNumber ? `第${scan.rowNumber}行` : scan?.status === 'fail' ? '未找到' : '掃描結果將顯示在這裡'

  return (
    <div className="qrk-root" onKeyDown={onToolKeyDown} onPaste={onPaste} onCopy={onCopy}>
      <section className="qrk-section" aria-label="掃描">
        <h2 className="qrk-title">掃描畫面與結果</h2>
        <div className="qrk-actions">
          <Button
            className="qrk-stop"
            variant={camera.phase === 'live' || camera.phase === 'starting' ? 'danger' : 'primary'}
            onClick={() => {
              if (camera.phase === 'live' || camera.phase === 'starting') camera.stop()
              else void camera.start()
            }}
          >
            {camera.phase === 'live' || camera.phase === 'starting' ? '停止掃描' : '開始掃描'}
          </Button>
          <div className="qrk-chips">
            <span className={`qrk-chip is-${camera.phase}`}>{cameraLabel(camera.phase)}</span>
            <span className={`qrk-chip is-${scanTone}`} role="status">
              {scanLabel}
            </span>
            {duplicateCount > 1 ? <span className="qrk-chip is-warn">重複 {duplicateCount} 個</span> : null}
          </div>
        </div>
        {camera.error ? <Banner tone="danger">{camera.error}</Banner> : null}
        <div className="qrk-split">
          <div className="qrk-stage">
            <video ref={camera.videoRef} className="qrk-video" muted playsInline autoPlay />
            <canvas ref={camera.canvasRef} className="qrk-canvas" aria-hidden />
          </div>
          <div className={`qrk-result${scan ? ` is-${scan.status}` : ''}`} aria-live="polite">
            <div className="qrk-result-head">
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
                <p className="qrk-label">
                  QR碼: {scan.qr}
                  {scan.rowNumber ? ` (第${scan.rowNumber}行)` : ''}
                </p>
                <p className="qrk-value">{scan.parameter}</p>
                <p className="qrk-time">掃描時間: {scan.time}</p>
              </>
            ) : (
              <p className="qrk-empty">掃描 QR 碼後將顯示對應參數</p>
            )}
          </div>
        </div>
      </section>

      <section className="qrk-section">
        <h2 className="qrk-title">數據表格</h2>
        {notice ? <Banner tone="warning">{notice}</Banner> : null}
        <div className="qrk-toolbar" role="group" aria-label="表格操作">
          <Button title="新增一行 (Ctrl+N)" onClick={addRow}>
            新增行
          </Button>
          <Button variant="danger" title="刪除選中行 (Delete)" onClick={deleteRow}>
            刪除行
          </Button>
          <Button variant="ghost" title="鍵值模式固定 2 列" onClick={rejectColumn}>
            新增列
          </Button>
          <Button variant="ghost" title="鍵值模式固定 2 列" onClick={rejectColumn}>
            刪除列
          </Button>
          <Button variant="danger" title="清空所有數據" onClick={clearTable}>
            清空表格
          </Button>
          <Button variant="ghost" title="匯出為 TSV" onClick={exportData}>
            匯出數據
          </Button>
          <FileInput label="匯入數據" accept={ACCEPT} hint="支援 .txt、.tsv、.csv、.xlsx、.xls" onFiles={(files) => void onFiles(files)} />
          <Button variant="ghost" title="全選所有數據 (Ctrl+A)" onClick={selectAll}>
            全選
          </Button>
          <Button variant="ghost" title="複製選中行" onClick={duplicateSelected}>
            複製行
          </Button>
        </div>
        <p className={`qrk-meta is-${storage}`}>
          數據行數: {rows.length} | 格式: QR碼 ↔ 參數 | {STORAGE_LABEL[storage]}
        </p>
        <p className="qrk-hint">
          匯入格式：TSV（Tab 分隔）、CSV（逗號分隔）、Excel（.xlsx / .xls）、TXT。Tab / Enter
          移動儲存格，最後一格再按會新增一行。Ctrl+N 新增行，Ctrl+S 儲存，Ctrl+A 選取文字，Ctrl+C / Ctrl+V 複製貼上。
        </p>
        <div className="qrk-grid-wrap">
          <table className="qrk-grid">
            <caption className="sr-only">QR碼與對應參數</caption>
            <thead>
              <tr>
                <th className="row-num" scope="col">
                  #
                </th>
                {HEADERS.map((header) => (
                  <th key={header} scope="col">
                    {header}
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
                  {HEADERS.map((header, col) => {
                    const hit = hits.find((item) => item.row === rowIndex && item.col === col)
                    const valueHit = col === 1 && hits.some((item) => item.row === rowIndex && item.kind === 'match')
                    const className = [
                      selected?.row === rowIndex && selected.col === col ? 'is-selected' : '',
                      hit?.kind === 'match' ? 'is-hit' : '',
                      hit?.kind === 'duplicate' ? 'is-dup' : '',
                      valueHit ? 'is-value' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <td key={header} className={className}>
                        <input
                          ref={(node) => {
                            const id = `${rowIndex}:${col}`
                            if (node) inputs.current.set(id, node)
                            else inputs.current.delete(id)
                          }}
                          type="text"
                          value={row[col] ?? ''}
                          placeholder={PLACEHOLDERS[col]}
                          aria-label={`${header} 第${rowIndex + 1}行`}
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
        <section className="qrk-debug" aria-label="調試資訊">
          <div className="qrk-debug-head">
            <h2 className="qrk-title">調試資訊</h2>
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
