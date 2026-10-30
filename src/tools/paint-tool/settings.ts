export const SETTINGS_KEY = 'imageEditorSettings'

export type ToolName = 'brush' | 'eraser'
export type ExportUnit = 'px' | 'cm' | 'mm' | 'in' | 'pt'
export type BgMethod = 'simple' | 'advanced' | 'manual' | 'remove-bg' | 'clipdrop' | 'replicate'

export type EditorSettings = {
  brushColor: string
  brushSize: number
  currentTool: ToolName
  exportUnit: ExportUnit
  exportDPI: string
  exportWidth: string
  exportHeight: string
  keepAspectRatio: boolean
  bgMethod: BgMethod
  apiKey: string
}

export const DEFAULT_SETTINGS: EditorSettings = {
  brushColor: '#000000',
  brushSize: 5,
  currentTool: 'brush',
  exportUnit: 'px',
  exportDPI: '300',
  exportWidth: '800',
  exportHeight: '600',
  keepAspectRatio: true,
  bgMethod: 'simple',
  apiKey: '',
}

const TOOLS: readonly ToolName[] = ['brush', 'eraser']
const UNITS: readonly ExportUnit[] = ['px', 'cm', 'mm', 'in', 'pt']
const METHODS: readonly BgMethod[] = ['simple', 'advanced', 'manual', 'remove-bg', 'clipdrop', 'replicate']

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function text(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

export function readSettings(): EditorSettings | 'empty' | 'error' {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return 'empty'
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'error'
    const data = parsed as Partial<EditorSettings>
    const color = typeof data.brushColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.brushColor)
      ? data.brushColor
      : DEFAULT_SETTINGS.brushColor
    const size = typeof data.brushSize === 'number' && Number.isFinite(data.brushSize) && data.brushSize > 0
      ? data.brushSize
      : DEFAULT_SETTINGS.brushSize
    return {
      brushColor: color,
      brushSize: size,
      currentTool: oneOf(data.currentTool, TOOLS, DEFAULT_SETTINGS.currentTool),
      exportUnit: oneOf(data.exportUnit, UNITS, DEFAULT_SETTINGS.exportUnit),
      exportDPI: text(data.exportDPI, DEFAULT_SETTINGS.exportDPI),
      exportWidth: text(data.exportWidth, DEFAULT_SETTINGS.exportWidth),
      exportHeight: text(data.exportHeight, DEFAULT_SETTINGS.exportHeight),
      keepAspectRatio: typeof data.keepAspectRatio === 'boolean' ? data.keepAspectRatio : DEFAULT_SETTINGS.keepAspectRatio,
      bgMethod: oneOf(data.bgMethod, METHODS, DEFAULT_SETTINGS.bgMethod),
      apiKey: typeof data.apiKey === 'string' ? data.apiKey : '',
    }
  } catch {
    return 'error'
  }
}

export function writeSettings(settings: EditorSettings): boolean {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...settings, savedAt: new Date().toISOString() }),
    )
    return true
  } catch {
    return false
  }
}

export function clearSettings(): void {
  localStorage.removeItem(SETTINGS_KEY)
}
