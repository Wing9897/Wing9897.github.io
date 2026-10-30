import { useEffect, useRef, useState, type RefObject } from 'react'
import { init } from 'echarts'
import { Banner, Button, FileInput, Select, type SelectOption } from '@/components/ui'
import { openDatabase, queryReadonly, type Database, type SqlValue } from '@/lib'
import { buildSqliteChart, columnTitle, type ChartKind, type DisplayMode, type Scalar } from './options'
import './tool.css'

type Notice = { tone: 'info' | 'warning' | 'danger'; text: string }
type ChartHandle = {
  setOption: (option: unknown) => void
  resize: (size: { width: number; height: number }) => void
  dispose: () => void
  isDisposed: () => boolean
}

const CHART_TYPES: SelectOption[] = [
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
  { value: 'pie', label: 'Pie' },
  { value: 'scatter', label: 'Scatter' },
]
const DISPLAY_MODES: SelectOption[] = [
  { value: 'mapping', label: '對應分析' },
  { value: 'category', label: '分類統計' },
  { value: 'timeline', label: '時間-類別分布' },
]

function isChartKind(value: string): value is ChartKind {
  return value === 'line' || value === 'bar' || value === 'pie' || value === 'scatter'
}

function isDisplayMode(value: string): value is DisplayMode {
  return value === 'mapping' || value === 'category' || value === 'timeline'
}

function showYAfterMode(mode: DisplayMode, type: ChartKind): boolean {
  if (mode === 'category') return false
  if (mode === 'mapping' && type === 'pie') return false
  return true
}

function showYAfterType(mode: DisplayMode, type: ChartKind): boolean {
  if (type === 'pie') return false
  return mode !== 'category'
}

function toScalar(value: SqlValue | undefined): Scalar {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value == null) return null
  return `二進位（${value.byteLength} 位元組）`
}

function textOf(value: SqlValue | undefined): string {
  const scalar = toScalar(value)
  if (scalar == null) return '空值'
  if (scalar === '') return '空白'
  return String(scalar)
}

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`
}

function errorText(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback
  return /[\u3400-\u9fff]/.test(error.message) ? error.message : fallback
}

function createChart(element: HTMLElement): ChartHandle {
  const chart = init(element)
  const apply = chart.setOption as (option: unknown, notMerge?: boolean | { notMerge?: boolean }) => void
  const resize = chart.resize as (opts?: { width?: number; height?: number }) => void
  const probe = chart as { isDisposed?: () => boolean }
  return {
    setOption: (option) => {
      apply.call(chart, option, { notMerge: true })
    },
    resize: (size) => {
      resize.call(chart, { width: size.width, height: size.height })
    },
    dispose: () => {
      if (probe.isDisposed?.()) return
      chart.dispose()
    },
    isDisposed: () => probe.isDisposed?.() ?? false,
  }
}

function useContainerSize<T extends HTMLElement>(
  target: RefObject<T | null>,
  active: boolean,
  onSize: (width: number, height: number) => void,
) {
  const onSizeRef = useRef(onSize)
  onSizeRef.current = onSize

  useEffect(() => {
    const element = target.current
    if (!element || !active) return
    let lastWidth = -1
    let lastHeight = -1
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      if (width < 2 || height < 2) return
      if (Math.abs(width - lastWidth) < 2 && Math.abs(height - lastHeight) < 2) return
      lastWidth = width
      lastHeight = height
      onSizeRef.current(width, height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [active, target])
}

export default function Tool() {
  const [tables, setTables] = useState<string[] | null>(null)
  const [tableName, setTableName] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<SqlValue[][]>([])
  const [chartType, setChartType] = useState<ChartKind>('line')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('mapping')
  const [xIndex, setXIndex] = useState(0)
  const [yIndex, setYIndex] = useState(0)
  const [showY, setShowY] = useState(true)
  const [busy, setBusy] = useState(false)
  const [drawn, setDrawn] = useState(false)
  const [sourceNotice, setSourceNotice] = useState<Notice | null>(null)
  const [chartNotice, setChartNotice] = useState<Notice | null>(null)
  const dbRef = useRef<Database | null>(null)
  const chartRef = useRef<ChartHandle | null>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef(0)
  const aliveRef = useRef(true)
  const redrawRef = useRef<((narrow: boolean) => void) | null>(null)
  const layoutRef = useRef<boolean | null>(null)
  const hasData = columns.length > 0

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      dbRef.current?.close()
      dbRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!hasData) return
    return () => {
      chartRef.current?.dispose()
      chartRef.current = null
      redrawRef.current = null
      layoutRef.current = null
    }
  }, [hasData])

  useContainerSize(slotRef, hasData, (width, height) => {
    const chart = chartRef.current
    if (!chart || chart.isDisposed()) return
    const narrow = width < 768
    if (layoutRef.current !== null && layoutRef.current !== narrow) {
      layoutRef.current = narrow
      redrawRef.current?.(narrow)
    } else {
      layoutRef.current = narrow
    }
    const next = chartRef.current
    if (!next || next.isDisposed()) return
    next.resize({ width, height })
  })

  function ensureChart(): ChartHandle | null {
    const element = frameRef.current
    if (!element) return null
    const current = chartRef.current
    if (current && !current.isDisposed()) return current
    const created = createChart(element)
    chartRef.current = created
    return created
  }

  async function loadFile(files: FileList) {
    const file = files.item(0)
    if (!file) return
    const request = ++requestRef.current
    setBusy(true)
    setSourceNotice({ tone: 'info', text: '正在讀取資料庫…' })
    try {
      const bytes = await file.arrayBuffer()
      const next = await openDatabase(bytes)
      if (!aliveRef.current || request !== requestRef.current) {
        next.close()
        return
      }
      dbRef.current?.close()
      dbRef.current = next
      const listed = queryReadonly(next, "SELECT name FROM sqlite_master WHERE type = 'table'")
      const names = listed.values.flatMap((row) => (typeof row[0] === 'string' && row[0] !== '' ? [row[0]] : []))
      setTables(names)
      setTableName(names[0] ?? '')
      setColumns([])
      setRows([])
      setDrawn(false)
      setChartNotice(null)
      setSourceNotice(names.length === 0 ? { tone: 'warning', text: '這個資料庫沒有資料表' } : null)
    } catch (error) {
      if (!aliveRef.current || request !== requestRef.current) return
      setSourceNotice({ tone: 'danger', text: errorText(error, '無法讀取資料庫') })
    } finally {
      if (aliveRef.current && request === requestRef.current) setBusy(false)
    }
  }

  function loadTable() {
    const db = dbRef.current
    if (busy) return
    if (!db || !tableName) {
      setSourceNotice({ tone: 'warning', text: '請先載入資料' })
      return
    }
    try {
      const result = queryReadonly(db, `SELECT * FROM ${quoteIdent(tableName)}`)
      if (result.values.length === 0) {
        setSourceNotice({ tone: 'warning', text: '無資料' })
        return
      }
      setColumns(result.columns)
      setRows(result.values)
      setXIndex(0)
      setYIndex(0)
      setShowY(showYAfterMode(displayMode, chartType))
      setSourceNotice(null)
      setChartNotice(null)
    } catch (error) {
      setSourceNotice({ tone: 'danger', text: errorText(error, '無法載入資料表') })
    }
  }

  function paint(snapshot: {
    columns: string[]
    rows: Scalar[][]
    xIndex: number
    yIndex: number
    type: ChartKind
    mode: DisplayMode
  }, narrow: boolean, report: boolean) {
    const built = buildSqliteChart({ ...snapshot, narrow })
    if (!built.ok) {
      if (report) setChartNotice({ tone: 'warning', text: built.error })
      return
    }
    const chart = ensureChart()
    if (!chart) return
    chart.setOption(built.option)
    layoutRef.current = narrow
    const slot = slotRef.current
    if (slot) {
      const width = Math.round(slot.clientWidth)
      const height = Math.round(slot.clientHeight)
      if (width > 1 && height > 1) chart.resize({ width, height })
    }
    if (report) {
      setDrawn(true)
      setChartNotice(null)
    }
  }

  function drawChart() {
    if (rows.length === 0) {
      setChartNotice({ tone: 'warning', text: '請先載入資料' })
      return
    }
    const snapshot = {
      columns,
      rows: rows.map((row) => columns.map((_, index) => toScalar(row[index]))),
      xIndex,
      yIndex,
      type: chartType,
      mode: displayMode,
    }
    const narrow = (slotRef.current?.clientWidth ?? window.innerWidth) < 768
    redrawRef.current = (next) => {
      try {
        paint(snapshot, next, false)
      } catch (error) {
        console.error('繪製圖表時發生錯誤:', error)
      }
    }
    try {
      paint(snapshot, narrow, true)
    } catch (error) {
      console.error('繪製圖表時發生錯誤:', error)
      setChartNotice({ tone: 'danger', text: '繪製圖表失敗，請檢查數據或選擇其他表達方式' })
    }
  }

  const fieldOptions = columns.map((_, index) => ({
    value: String(index),
    label: columnTitle(columns, index),
  }))

  return (
    <div className="ech-tool" aria-busy={busy}>
      <section className="ech-panel">
        <h2>載入 SQLite 檔案</h2>
        <FileInput
          label="SQLite 檔案"
          accept=".sqlite,.db"
          hint="接受 .sqlite 與 .db，只在瀏覽器內讀取。"
          onFiles={(files) => {
            void loadFile(files)
          }}
        />
        {tables && tables.length > 0 ? (
          <div className="ech-load">
            <Select
              label="選擇資料表"
              value={tableName}
              options={tables.map((name) => ({ value: name, label: name }))}
              onChange={(event) => setTableName(event.target.value)}
            />
            <Button onClick={loadTable} disabled={busy || !tableName}>
              載入資料
            </Button>
          </div>
        ) : null}
        {sourceNotice ? <Banner tone={sourceNotice.tone}>{sourceNotice.text}</Banner> : null}
      </section>

      {hasData ? (
        <>
          <section className="ech-panel">
            <h2>資料預覽</h2>
            <p className="ech-meta">
              {rows.length.toLocaleString('zh-Hant')} 列，{columns.length.toLocaleString('zh-Hant')} 欄
            </p>
            <div className="ech-preview" tabIndex={0}>
              <table>
                <caption className="sr-only">資料預覽</caption>
                <thead>
                  <tr>
                    {columns.map((_, index) => (
                      <th key={index} scope="col">
                        {columnTitle(columns, index)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {columns.map((_, columnIndex) => (
                        <td key={columnIndex}>{textOf(row[columnIndex])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ech-panel">
            <h2>圖表設定</h2>
            <div className="ech-controls">
              <Select
                label="圖表類型"
                value={chartType}
                options={CHART_TYPES}
                onChange={(event) => {
                  if (!isChartKind(event.target.value)) return
                  setChartType(event.target.value)
                  setShowY(showYAfterType(displayMode, event.target.value))
                }}
              />
              <Select
                label="表達方式"
                value={displayMode}
                options={DISPLAY_MODES}
                onChange={(event) => {
                  if (!isDisplayMode(event.target.value)) return
                  setDisplayMode(event.target.value)
                  setShowY(showYAfterMode(event.target.value, chartType))
                }}
              />
              <Select
                label="X軸欄位"
                value={String(xIndex)}
                options={fieldOptions}
                onChange={(event) => setXIndex(Number(event.target.value))}
              />
              {showY ? (
                <Select
                  label="Y軸欄位"
                  value={String(yIndex)}
                  options={fieldOptions}
                  onChange={(event) => setYIndex(Number(event.target.value))}
                />
              ) : null}
              <Button onClick={drawChart}>繪製圖表</Button>
            </div>
            {chartNotice ? <Banner tone={chartNotice.tone}>{chartNotice.text}</Banner> : null}
            <div className="ech-slot" ref={slotRef}>
              <div className="ech-frame" ref={frameRef} role="img" aria-label="圖表" />
              {drawn ? null : <p className="ech-placeholder">選擇欄位後按「繪製圖表」。</p>}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
