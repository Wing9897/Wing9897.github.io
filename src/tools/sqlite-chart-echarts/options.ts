export type ChartKind = 'line' | 'bar' | 'pie' | 'scatter'
export type DisplayMode = 'mapping' | 'category' | 'timeline'
export type Scalar = string | number | null

export type ChartInput = {
  columns: string[]
  rows: Scalar[][]
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

function groupKey(value: Scalar | undefined): string {
  if (value == null) return '空值'
  if (value === '') return '空白'
  return String(value)
}

function measureOrZero(value: Scalar | undefined): number {
  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function frequencies(rows: Scalar[][], index: number): { labels: string[]; values: number[] } {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = groupKey(row[index])
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return { labels: [...counts.keys()], values: [...counts.values()] }
}

function uniqueLabels(rows: Scalar[][], index: number): string[] {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const row of rows) {
    const value = row[index]
    if (value == null) continue
    const label = String(value)
    if (seen.has(label)) continue
    seen.add(label)
    labels.push(label)
  }
  return labels
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

export function buildSqliteChart(input: ChartInput): ChartBuild {
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
  rows: Scalar[][],
  xIndex: number,
  yIndex: number,
  type: ChartKind,
  narrow: boolean,
  theme: ChartTheme,
): ChartBuild {
  const xName = columnTitle(columns, xIndex)
  const yName = columnTitle(columns, yIndex)
  const xData = rows.map((row) => groupKey(row[xIndex]))
  const yData = rows.map((row) => measureOrZero(row[yIndex]))
  return {
    ok: true,
    option: {
      backgroundColor: theme.bg,
      title: titleOf(`${yName} vs ${xName}`, theme),
      tooltip: { trigger: 'axis', confine: true },
      toolbox: toolbox(theme),
      grid: plotGrid(narrow),
      dataZoom: zoom(theme),
      xAxis: {
        type: 'category',
        name: xName,
        data: xData,
        boundaryGap: type === 'bar',
        ...axisLook(theme),
      },
      yAxis: {
        type: 'value',
        name: yName,
        scale: true,
        ...axisLook(theme),
      },
      series: [
        {
          type,
          data: yData,
          smooth: type === 'line',
          showSymbol: true,
          itemStyle: { color: SERIES_COLOR },
        },
      ],
    },
  }
}

function categoryOption(
  columns: string[],
  rows: Scalar[][],
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
        legend: {
          type: 'scroll',
          orient: narrow ? 'horizontal' : 'vertical',
          left: narrow ? 'center' : 0,
          top: narrow ? undefined : 'middle',
          bottom: narrow ? 0 : undefined,
          data: labels,
          textStyle: { color: theme.text, fontFamily: theme.font },
        },
        series: [
          {
            name: '頻率',
            type: 'pie',
            radius: narrow ? '46%' : '50%',
            center: narrow ? ['50%', '44%'] : ['50%', '50%'],
            data: labels.map((name, index) => ({ name, value: values[index] ?? 0 })),
            label: { show: !narrow, color: theme.text, fontFamily: theme.font },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0,0,0,0.5)',
              },
            },
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
      toolbox: toolbox(theme),
      grid: plotGrid(narrow),
      dataZoom: zoom(theme),
      xAxis: {
        type: 'category',
        name: xName,
        data: labels,
        boundaryGap: type === 'bar',
        ...axisLook(theme),
      },
      yAxis: {
        type: 'value',
        name: '出現次數',
        scale: true,
        ...axisLook(theme),
      },
      series: [
        {
          type,
          data: values,
          smooth: type === 'line',
          itemStyle: { color: SERIES_COLOR },
        },
      ],
    },
  }
}

function timelineOption(
  columns: string[],
  rows: Scalar[][],
  xIndex: number,
  yIndex: number,
  narrow: boolean,
  theme: ChartTheme,
): ChartBuild {
  const xName = columnTitle(columns, xIndex)
  const yName = columnTitle(columns, yIndex)
  const categories = uniqueLabels(rows, yIndex)
  if (categories.length === 0) return { ok: false, error: 'Y 軸類別數據無效，請選擇有效的類別欄位' }

  const seriesData: [string, number][] = []
  for (const row of rows) {
    const time = row[xIndex]
    const category = row[yIndex]
    if (time == null || category == null) continue
    const yValue = categories.indexOf(String(category))
    if (yValue < 0) continue
    seriesData.push([String(time), yValue])
  }
  if (seriesData.length === 0) return { ok: false, error: '無有效的時間-類別數據，請檢查數據內容' }

  const times = uniqueLabels(rows, xIndex)
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
        type: 'category',
        name: xName,
        data: times,
        ...axisLook(theme, { rotate: 45, hideOverlap: false }),
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
  if (time == null || typeof catIdx !== 'number') return '無有效數據'
  const category = categories[catIdx]
  return `時間: ${String(time)}<br>類別: ${category || '未知'}`
}
