import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js'
import { Banner, Button, FileInput, Select, type SelectOption } from '@/components/ui'
import { openDatabase, queryReadonly, type Database, type SqlValue } from '@/lib'
import './tool.css'

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Tooltip,
)

type ChartKind = 'line' | 'bar' | 'pie'
type DisplayMode = 'mapping' | 'category'
type Notice = { tone: 'info' | 'warning' | 'danger'; text: string }
type ThemeColors = { text: string; border: string; font: string }

const CHART_TYPES: SelectOption[] = [
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
  { value: 'pie', label: 'Pie' },
]
const DISPLAY_MODES: SelectOption[] = [
  { value: 'mapping', label: '對應分析' },
  { value: 'category', label: '分類統計' },
]

function isChartKind(value: string): value is ChartKind {
  return value === 'line' || value === 'bar' || value === 'pie'
}

function isDisplayMode(value: string): value is DisplayMode {
  return value === 'mapping' || value === 'category'
}

function columnTitle(columns: string[], index: number): string {
  const name = columns[index] ?? ''
  if (name === '') return `未命名欄位 ${index + 1}`
  let count = 0
  for (const item of columns) if (item === name) count += 1
  return count > 1 ? `${name}（${index + 1}）` : name
}

function axisText(value: SqlValue | undefined): string {
  if (value == null) return '空值'
  if (value === '') return '空白'
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  return `二進位（${value.byteLength} 位元組）`
}

function parseMeasure(value: SqlValue | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number.parseFloat(value)
  return Number.NaN
}

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`
}

function errorText(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback
  return /[\u3400-\u9fff]/.test(error.message) ? error.message : fallback
}

function readChartTheme(): ThemeColors {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    text: read('--color-text', '#1f1c18'),
    border: read('--color-border', '#e3dfd6'),
    font: read('--font-sans', 'sans-serif'),
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
  const [busy, setBusy] = useState(false)
  const [drawn, setDrawn] = useState(false)
  const [sourceNotice, setSourceNotice] = useState<Notice | null>(null)
  const [chartNotice, setChartNotice] = useState<Notice | null>(null)
  const dbRef = useRef<Database | null>(null)
  const chartRef = useRef<Chart | null>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const requestRef = useRef(0)
  const aliveRef = useRef(true)
  const hasData = columns.length > 0
  const showY = displayMode === 'mapping'

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
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [hasData])

  useContainerSize(slotRef, hasData, (width, height) => {
    const chart = chartRef.current
    if (!chart) return
    const position = width < 768 ? 'bottom' : 'top'
    const legend = chart.options.plugins?.legend as { position?: string } | undefined
    if (legend && legend.position !== position) {
      legend.position = position
      chart.update('none')
    }
    chart.resize(width, height)
  })

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
      setSourceNotice(null)
      setChartNotice(null)
    } catch (error) {
      setSourceNotice({ tone: 'danger', text: errorText(error, '無法載入資料表') })
    }
  }

  function drawChart() {
    const canvas = canvasRef.current
    if (!canvas || rows.length === 0) {
      setChartNotice({ tone: 'warning', text: '請先載入資料' })
      return
    }
    if (xIndex < 0 || xIndex >= columns.length) {
      setChartNotice({ tone: 'warning', text: '請選擇 X 軸欄位' })
      return
    }
    if (showY && (yIndex < 0 || yIndex >= columns.length)) {
      setChartNotice({ tone: 'warning', text: '請選擇 Y 軸欄位' })
      return
    }

    try {
      const narrow = (slotRef.current?.clientWidth ?? window.innerWidth) < 768
      const theme = readChartTheme()
      const xName = columnTitle(columns, xIndex)
      const mapping = displayMode === 'mapping'
      let labels: string[]
      let seriesData: number[]
      let seriesLabel: string
      let yName: string
      let backgroundColor: string | string[]
      if (mapping) {
        const yLabel = columnTitle(columns, yIndex)
        labels = rows.map((row) => axisText(row[xIndex]))
        seriesData = rows.map((row) => parseMeasure(row[yIndex]))
        seriesLabel = `${yLabel} vs ${xName}`
        yName = yLabel
        backgroundColor = 'rgba(75,192,192,0.6)'
      } else {
        const counts = new Map<string, number>()
        for (const row of rows) {
          const key = axisText(row[xIndex])
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        labels = [...counts.keys()]
        seriesData = [...counts.values()]
        seriesLabel = `${xName} 頻率統計`
        yName = '出現次數'
        const step = labels.length > 0 ? 360 / labels.length : 0
        backgroundColor = labels.map((_, index) => `hsl(${index * step}, 70%, 60%)`)
      }

      const dataset: {
        label: string
        data: number[]
        backgroundColor: string | string[]
        borderColor?: string
        borderWidth?: number
      } = { label: seriesLabel, data: seriesData, backgroundColor }
      if (mapping) {
        dataset.borderColor = 'rgba(75,192,192,1)'
        dataset.borderWidth = 1
      }

      const options: Record<string, unknown> = {
        responsive: true,
        maintainAspectRatio: false,
        color: theme.text,
        font: { family: theme.font },
        layout: { padding: { top: 8, right: 12, bottom: 4, left: 4 } },
        plugins: {
          legend: {
            position: narrow ? 'bottom' : 'top',
            labels: { color: theme.text, font: { family: theme.font }, boxWidth: 12 },
          },
        },
      }
      if (chartType !== 'pie') {
        options.scales = {
          x: {
            type: 'category',
            offset: chartType === 'bar',
            title: { display: true, text: xName, color: theme.text, font: { family: theme.font } },
            ticks: { color: theme.text, maxRotation: 50, minRotation: 0, autoSkip: true },
            grid: { color: theme.border, offset: chartType === 'bar' },
            border: { color: theme.border },
          },
          y: {
            type: 'linear',
            beginAtZero: chartType === 'bar',
            title: { display: true, text: yName, color: theme.text, font: { family: theme.font } },
            ticks: { color: theme.text },
            grid: { color: theme.border },
            border: { color: theme.border },
          },
        }
      }

      chartRef.current?.destroy()
      const chart = new Chart(canvas, {
        type: chartType,
        data: { labels, datasets: [dataset] },
        options,
      } as unknown as ChartConfiguration)
      chartRef.current = chart
      const slot = slotRef.current
      const width = Math.round(slot?.clientWidth ?? 0)
      const height = Math.round(slot?.clientHeight ?? 0)
      if (width > 1 && height > 1) chart.resize(width, height)
      setDrawn(true)
      setChartNotice(null)
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
    <div className="cjs-tool" aria-busy={busy}>
      <section className="cjs-panel">
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
          <div className="cjs-load">
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
          <section className="cjs-panel">
            <h2>資料預覽</h2>
            <p className="cjs-meta">
              {rows.length.toLocaleString('zh-Hant')} 列，{columns.length.toLocaleString('zh-Hant')} 欄
            </p>
            <div className="cjs-preview" tabIndex={0}>
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
                        <td key={columnIndex}>{axisText(row[columnIndex])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="cjs-panel">
            <h2>圖表設定</h2>
            <div className="cjs-controls">
              <Select
                label="圖表類型"
                value={chartType}
                options={CHART_TYPES}
                onChange={(event) => {
                  if (isChartKind(event.target.value)) setChartType(event.target.value)
                }}
              />
              <Select
                label="表達方式"
                value={displayMode}
                options={DISPLAY_MODES}
                onChange={(event) => {
                  if (isDisplayMode(event.target.value)) setDisplayMode(event.target.value)
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
            <div className="cjs-slot" ref={slotRef}>
              <div className="cjs-frame">
                <canvas ref={canvasRef} role="img" aria-label="圖表" />
              </div>
              {drawn ? null : <p className="cjs-placeholder">選擇欄位後按「繪製圖表」。</p>}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
