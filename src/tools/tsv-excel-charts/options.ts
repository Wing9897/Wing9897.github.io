export type ChartKind = 'line' | 'bar' | 'pie' | 'scatter'
export type DisplayMode = 'mapping' | 'category' | 'timeline'

export type ChartInput = {
  columns: string[]
  rows: string[][]
  xIndex: number
  yIndex: number
  type: ChartKind
  mode: DisplayMode
  narrow: boolean
}

export type ChartBuild = { ok: true; option: unknown } | { ok: false; error: string }

type ChartTheme = {
  text: string
  muted: string
  border: string
  bg: string
  font: string
}

const SERIES_COLOR = 'rgba(75,192,192,0.8)'
const AXIS_TIME: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}
const TIP_TIME: Intl.DateTimeFormatOptions = {
  ...AXIS_TIME,
  second: '2-digit',
}

export function columnTitle(columns: string[], index: number): string {
  const name = columns[index] ?? ''
  if (name === '') return `未命名欄位 ${index + 1}`
  let count = 0
  for (const item of columns) if (item === name) count += 1
  return count > 1 ? `${name}（${index + 1}）` : name
}

function readChartTheme(): ChartTheme {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    text: read('--color-text', '#1f1c18'),
    muted: read('--color-text-muted', '#5f5a54'),
    border: read('--color-border', '#e3dfd6'),
    bg: read('--color-bg', '#f4f3ef'),
    font: read('--font-sans', 'sans-serif'),
  }
}

function cell(row: string[], index: number): string {
  return row[index] ?? ''
}

function groupKey(value: string | undefined): string {
  if (value == null || value === '') return '空白'
  return value
}

function measureOrZero(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? '')
  return parsed || 0
}

function frequencies(rows: string[][], index: number): { labels: string[]; values: number[] } {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = groupKey(row[index])
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return { labels: [...counts.keys()], values: [...counts.values()] }
}

function titleOf(text: string, theme: ChartTheme) {
  return {
    text,
    textStyle: {
      color: theme.text,
      fontFamily: theme.font,
      fontSize: 16,
      fontWeight: 600,
    },
  }
}

function zoom(theme: ChartTheme) {
  const textStyle = { color: theme.text, fontFamily: theme.font }
  return [
    { type: 'inside', xAxisIndex: 0 },
    { type: 'slider', xAxisIndex: 0, height: 16, bottom: 4, textStyle },
    { type: 'inside', yAxisIndex: 0 },
    { type: 'slider', yAxisIndex: 0, width: 16, right: 4, textStyle },
  ]
}

function toolbox(theme: ChartTheme) {
  return {
    right: 8,
    top: 4,
    iconStyle: { borderColor: theme.text },
    feature: { restore: {}, saveAsImage: {} },
  }
}

function plotGrid(narrow: boolean) {
  return {
    containLabel: true,
    left: 8,
    right: narrow ? 28 : 36,
    top: 48,
    bottom: narrow ? 28 : 36,
  }
}

function axisLook(theme: ChartTheme, axisLabel?: Record<string, unknown>) {
  return {
    nameTextStyle: { color: theme.muted, fontFamily: theme.font },
    axisLabel: {
      color: theme.text,
      fontFamily: theme.font,
      hideOverlap: true,
      ...axisLabel,
    },
    axisLine: { lineStyle: { color: theme.border } },
    axisTick: { lineStyle: { color: theme.border } },
    splitLine: { lineStyle: { color: theme.border } },
  }
}

function invalidField(index: number, length: number): boolean {
  return index < 0 || index >= length
}

export function buildTsvChart(input: ChartInput): ChartBuild {
  const { columns, rows, xIndex, yIndex, type, mode, narrow } = input
  if (rows.length === 0) return { ok: false, error: '請先載入資料' }
  if (invalidField(xIndex, columns.length)) return { ok: false, error: '請選擇 X 軸欄位' }
  const needsY = type !== 'pie' && mode !== 'category'
  if (needsY && invalidField(yIndex, columns.length)) return { ok: false, error: '請選擇 Y 軸欄位' }

  const theme = readChartTheme()
  if (type === 'pie') return categoryOption(columns, rows, xIndex, 'pie', narrow, theme)
  if (mode === 'mapping') return mappingOption(columns, rows, xIndex, yIndex, type, narrow, theme)
  if (mode === 'category') return categoryOption(columns, rows, xIndex, type, narrow, theme)
  if (type !== 'scatter') return { ok: false, error: '時間-類別分布僅支援散點圖' }
  return timelineOption(columns, rows, xIndex, yIndex, narrow, theme)
}

function mappingOption(
  columns: string[],
  rows: string[][],
  xIndex: number,
  yIndex: number,
  type: ChartKind,
  narrow: boolean,
  theme: ChartTheme,
): ChartBuild {
  const xName = columnTitle(columns, xIndex)
  const yName = columnTitle(columns, yIndex)
  const xData = rows.map((row) => groupKey(cell(row, xIndex)))
  const yData = rows.map((row) => measureOrZero(cell(row, yIndex)))
  const data =
    type === 'scatter'
      ? rows.map((row) => [measureOrZero(cell(row, xIndex)), measureOrZero(cell(row, yIndex))])
      : yData
  return {
    ok: true,
    option: {
      backgroundColor: theme.bg,
      title: titleOf(`${yName} vs ${xName}`, theme),
      tooltip: { trigger: 'axis', confine: true },
      grid: plotGrid(narrow),
      dataZoom: zoom(theme),
      xAxis: {
        type: 'category',
        data: xData,
        ...axisLook(theme),
      },
      yAxis: {
        type: 'value',
        ...axisLook(theme),
      },
      series: [
        {
          type,
          data,
          smooth: type === 'line',
        },
      ],
    },
  }
}

function categoryOption(
  columns: string[],
  rows: string[][],
  xIndex: number,
  type: ChartKind,
  narrow: boolean,
  theme: ChartTheme,
): ChartBuild {
  const xName = columnTitle(columns, xIndex)
  const { labels, values } = frequencies(rows, xIndex)
  const heading = titleOf(`${xName} 頻率統計`, theme)
  if (type === 'pie') {
    return {
      ok: true,
      option: {
        backgroundColor: theme.bg,
        title: heading,
        tooltip: { trigger: 'item', confine: true },
        series: [
          {
            type: 'pie',
            data: labels.map((name, index) => ({ name, value: values[index] ?? 0 })),
            label: { show: !narrow, color: theme.text, fontFamily: theme.font },
            labelLine: { lineStyle: { color: theme.border } },
          },
        ],
      },
    }
  }

  return {
    ok: true,
    option: {
      backgroundColor: theme.bg,
      title: heading,
      tooltip: { trigger: 'axis', confine: true },
      grid: plotGrid(narrow),
      dataZoom: zoom(theme),
      xAxis: {
        type: 'category',
        data: labels,
        ...axisLook(theme),
      },
      yAxis: {
        type: 'value',
        ...axisLook(theme),
      },
      series: [
        {
          type,
          data: values,
          smooth: type === 'line',
        },
      ],
    },
  }
}

function timelineOption(
  columns: string[],
  rows: string[][],
  xIndex: number,
  yIndex: number,
  narrow: boolean,
  theme: ChartTheme,
): ChartBuild {
  const xName = columnTitle(columns, xIndex)
  const yName = columnTitle(columns, yIndex)
  const categories: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const category = row[yIndex]
    if (category == null) continue
    if (seen.has(category)) continue
    seen.add(category)
    categories.push(category)
  }
  if (categories.length === 0) return { ok: false, error: 'Y 軸類別數據無效，請選擇有效的類別欄位' }

  const seriesData: [number, number][] = []
  for (const row of rows) {
    const time = row[xIndex]
    const category = row[yIndex]
    if (time == null || category == null) continue
    const parsed = Date.parse(time)
    if (Number.isNaN(parsed)) continue
    const yValue = categories.indexOf(category)
    if (yValue < 0) continue
    seriesData.push([parsed, yValue])
  }
  seriesData.sort((a, b) => a[0] - b[0])
  if (seriesData.length === 0) {
    return {
      ok: false,
      error: "無有效的時間-類別數據，請檢查數據內容（確保時間格式正確，例如 '2023-01-01 14:30:00'）",
    }
  }

  return {
    ok: true,
    option: {
      backgroundColor: theme.bg,
      title: titleOf(`${yName} 隨時間分布`, theme),
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: unknown) => timelineTooltip(params, categories),
      },
      toolbox: toolbox(theme),
      grid: plotGrid(narrow),
      dataZoom: zoom(theme),
      xAxis: {
        type: 'time',
        name: xName,
        ...axisLook(theme, {
          rotate: 45,
          hideOverlap: false,
          formatter: (value: string | number) => new Date(value).toLocaleString('zh-TW', AXIS_TIME),
        }),
      },
      yAxis: {
        type: 'category',
        name: yName,
        data: categories,
        ...axisLook(theme),
      },
      series: [
        {
          type: 'scatter',
          data: seriesData,
          symbolSize: 10,
          itemStyle: { color: SERIES_COLOR },
        },
      ],
    },
  }
}

function timelineTooltip(params: unknown, categories: string[]): string {
  if (!params || typeof params !== 'object') return '無有效數據'
  const data = (params as { data?: unknown }).data
  if (!Array.isArray(data)) return '無有效數據'
  const time = data[0]
  const catIdx = data[1]
  if (typeof time !== 'number' || typeof catIdx !== 'number') return '無有效數據'
  const dateTime = new Date(time).toLocaleString('zh-TW', TIP_TIME)
  return `時間: ${dateTime}<br>類別: ${categories[catIdx] || '未知'}`
}
