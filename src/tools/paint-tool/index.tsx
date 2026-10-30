import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Banner, Button, Checkbox, Field, FileInput, Modal, Select, labelClass } from '@/components/ui'
import './tool.css'
import {
  contextOf,
  editPixels,
  exportCanvas,
  hexToRgb,
  removeAdvancedBackground,
  removeBackgroundWithAi,
  removeColorRange,
} from './process'
import {
  DEFAULT_SETTINGS,
  clearSettings,
  readSettings,
  writeSettings,
  type BgMethod,
  type EditorSettings,
  type ExportUnit,
  type ToolName,
} from './settings'

const SIZES = [
  { size: 2, label: '細' },
  { size: 5, label: '中' },
  { size: 10, label: '粗' },
] as const

const PRESETS = [
  { id: 'hd', label: 'HD', width: 1920, height: 1080 },
  { id: '2k', label: '2K', width: 2560, height: 1440 },
  { id: '4k', label: '4K', width: 3840, height: 2160 },
  { id: 'web', label: '網頁', width: 800, height: 600 },
  { id: 'square', label: '方形', width: 1080, height: 1080 },
  { id: 'icon', label: '小圖示', width: 64, height: 64 },
  { id: 'micro', label: '微圖示', width: 32, height: 32 },
  { id: 'tiny', label: '極小', width: 16, height: 16 },
] as const

const FORMATS = [
  { id: 'svg', label: 'SVG' },
  { id: 'png', label: 'PNG' },
  { id: 'jpg', label: 'JPG' },
  { id: 'webp', label: 'WebP' },
  { id: 'pdf', label: 'PDF' },
] as const

const METHODS: { value: BgMethod; label: string }[] = [
  { value: 'simple', label: '簡單移除（白色背景）' },
  { value: 'advanced', label: '進階移除（智能檢測）' },
  { value: 'manual', label: '手動選擇顏色' },
  { value: 'remove-bg', label: 'Remove.bg AI' },
  { value: 'clipdrop', label: 'ClipDrop AI' },
  { value: 'replicate', label: 'Replicate AI' },
]

const UNITS: { value: ExportUnit; label: string }[] = [
  { value: 'px', label: '像素 (px)' },
  { value: 'cm', label: '公分 (cm)' },
  { value: 'mm', label: '毫米 (mm)' },
  { value: 'in', label: '英吋 (in)' },
  { value: 'pt', label: '點 (pt)' },
]

type Notice = { tone: 'success' | 'danger' | 'info' | 'warning'; text: string } | null
type DrawState = {
  mode: boolean
  tool: ToolName
  color: string
  size: number
  active: boolean
  pointerId: number
  lastX: number
  lastY: number
}

function canvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = rect.width > 0 ? canvas.width / rect.width : 1
  const scaleY = rect.height > 0 ? canvas.height / rect.height : 1
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  }
}

function cursorFor(tool: ToolName, color: string): string {
  const svg =
    tool === 'eraser'
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="white" stroke="#666" stroke-width="2"/><path d="M8 8L16 16M16 8L8 16" stroke="#666" stroke-width="2" stroke-linecap="round"/></svg>'
      : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M3 21L12 12L21 3L18 0L9 9L0 18L3 21Z" fill="${color}" stroke="#333" stroke-width="1"/><circle cx="12" cy="12" r="2" fill="${color}"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, auto`
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default function Tool() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef<DrawState>({
    mode: false,
    tool: 'brush',
    color: '#000000',
    size: 5,
    active: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
  })
  const settingsRef = useRef<EditorSettings>(DEFAULT_SETTINGS)
  const timerRef = useRef<number | null>(null)
  const skipSave = useRef(true)
  const pasteRef = useRef<() => Promise<void>>(async () => {})
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS)
  const [drawingMode, setDrawingMode] = useState(false)
  const [hasImage, setHasImage] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })
  const [preset, setPreset] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [colorOpen, setColorOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [bgColor, setBgColor] = useState('#ffffff')

  settingsRef.current = settings
  drawRef.current.mode = drawingMode
  drawRef.current.tool = settings.currentTool
  drawRef.current.color = settings.brushColor
  drawRef.current.size = settings.brushSize

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || canvas.dataset.ready === '1') return
    canvas.width = 800
    canvas.height = 600
    canvas.dataset.ready = '1'
  }, [])

  useEffect(() => {
    const saved = readSettings()
    if (saved === 'error') setNotice({ tone: 'danger', text: '載入設定失敗' })
    else if (saved !== 'empty') {
      setSettings(saved)
      setNotice({ tone: 'success', text: '設定已載入！' })
    }
  }, [])

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      if (!writeSettings(settings)) setNotice({ tone: 'danger', text: '儲存設定失敗' })
    }, 2000)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [settings])

  useEffect(() => {
    const onLeave = () => {
      if (!timerRef.current) return
      window.clearTimeout(timerRef.current)
      timerRef.current = null
      writeSettings(settingsRef.current)
    }
    window.addEventListener('beforeunload', onLeave)
    const interval = window.setInterval(() => writeSettings(settingsRef.current), 5 * 60 * 1000)
    return () => {
      window.removeEventListener('beforeunload', onLeave)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const onPaste = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.key !== 'v') return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      void pasteRef.current()
    }
    document.addEventListener('keydown', onPaste)
    return () => document.removeEventListener('keydown', onPaste)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.style.cursor = drawingMode ? cursorFor(settings.currentTool, settings.brushColor) : 'default'
  }, [drawingMode, settings.currentTool, settings.brushColor])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), notice.tone === 'danger' ? 5000 : 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  function notify(text: string, tone: 'success' | 'danger' | 'info' | 'warning') {
    setNotice({ text, tone })
  }

  function loadBlob(blob: Blob) {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        URL.revokeObjectURL(url)
        return
      }
      const maxWidth = 800
      const maxHeight = 600
      let width = image.width
      let height = image.height
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width *= ratio
        height *= ratio
      }
      canvas.width = Math.max(1, Math.round(width))
      canvas.height = Math.max(1, Math.round(height))
      const context = contextOf(canvas)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      setHasImage(true)
      setCanvasSize({ w: canvas.width, h: canvas.height })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      notify('無法讀取圖像', 'danger')
    }
    image.src = url
  }

  async function pasteImage() {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        for (const type of item.types) {
          if (!type.startsWith('image/')) continue
          loadBlob(await item.getType(type))
          return
        }
      }
      notify('剪貼簿中沒有找到圖像', 'danger')
    } catch {
      notify('貼上失敗，請確保剪貼簿中有圖像', 'danger')
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = contextOf(canvas)
    context.globalCompositeOperation = 'source-over'
    context.clearRect(0, 0, canvas.width, canvas.height)
  }

  function strokeTo(canvas: HTMLCanvasElement, x: number, y: number) {
    const state = drawRef.current
    const context = contextOf(canvas)
    context.beginPath()
    context.moveTo(state.lastX, state.lastY)
    context.lineTo(x, y)
    if (state.tool === 'eraser') {
      context.strokeStyle = '#ffffff'
      context.globalCompositeOperation = 'destination-out'
    } else {
      context.strokeStyle = state.color
      context.globalCompositeOperation = 'source-over'
    }
    context.lineWidth = state.size
    context.lineCap = 'round'
    context.stroke()
    state.lastX = x
    state.lastY = y
  }

  pasteRef.current = pasteImage

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawRef.current.mode) return
    const canvas = event.currentTarget
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      /* pointer may already be released */
    }
    const point = canvasPoint(canvas, event.clientX, event.clientY)
    drawRef.current.active = true
    drawRef.current.pointerId = event.pointerId
    drawRef.current.lastX = point.x
    drawRef.current.lastY = point.y
    event.preventDefault()
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const state = drawRef.current
    if (!state.active || !state.mode || event.pointerId !== state.pointerId) return
    const point = canvasPoint(event.currentTarget, event.clientX, event.clientY)
    strokeTo(event.currentTarget, point.x, point.y)
    event.preventDefault()
  }

  function stopPointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerId !== drawRef.current.pointerId) return
    drawRef.current.active = false
    drawRef.current.pointerId = -1
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  async function removeBackground() {
    const canvas = canvasRef.current
    if (!canvas) return
    const method = settings.bgMethod
    if (method === 'manual') {
      setColorOpen(true)
      return
    }
    if (method === 'remove-bg' || method === 'clipdrop' || method === 'replicate') {
      if (!settings.apiKey.trim()) {
        notify('請輸入 API Key', 'danger')
        return
      }
      setBusy(true)
      try {
        await removeBackgroundWithAi(canvas, method, settings.apiKey.trim())
        notify('AI 去背景完成！', 'success')
      } catch (error) {
        notify(`AI 去背景失敗: ${error instanceof Error ? error.message : '未知錯誤'}`, 'danger')
      } finally {
        setBusy(false)
      }
      return
    }

    setBusy(true)
    try {
      await wait(1000)
      editPixels(canvas, (data, width, height) => {
        if (method === 'simple') removeColorRange(data, [240, 240, 240], [255, 255, 255], 30)
        else removeAdvancedBackground(data, width, height)
      })
      notify('背景移除完成！', 'success')
    } catch {
      notify('去背景失敗', 'danger')
    } finally {
      setBusy(false)
    }
  }

  async function confirmBgColor() {
    const canvas = canvasRef.current
    const rgb = hexToRgb(bgColor)
    if (!canvas || !rgb) {
      notify('去背景失敗', 'danger')
      return
    }
    setBusy(true)
    try {
      await wait(500)
      editPixels(canvas, (data) => {
        removeColorRange(
          data,
          [rgb.r - 30, rgb.g - 30, rgb.b - 30],
          [rgb.r + 30, rgb.g + 30, rgb.b + 30],
          30,
        )
      })
      setColorOpen(false)
      notify('背景顏色移除完成！', 'success')
    } catch {
      notify('去背景失敗', 'danger')
    } finally {
      setBusy(false)
    }
  }

  function onWidth(value: string) {
    setPreset('')
    setSettings((current) => {
      if (!current.keepAspectRatio) return { ...current, exportWidth: value }
      const canvas = canvasRef.current
      const width = Number(value)
      if (!canvas || canvas.height === 0 || !Number.isFinite(width)) return { ...current, exportWidth: value }
      const height = Math.round(width / (canvas.width / canvas.height))
      return { ...current, exportWidth: value, exportHeight: String(height) }
    })
  }

  function onKeep(checked: boolean) {
    setSettings((current) => {
      if (!checked) return { ...current, keepAspectRatio: false }
      const canvas = canvasRef.current
      if (!canvas) return { ...current, keepAspectRatio: true }
      return {
        ...current,
        keepAspectRatio: true,
        exportWidth: String(canvas.width),
        exportHeight: String(canvas.height),
      }
    })
  }

  async function onExport(format: (typeof FORMATS)[number]['id']) {
    const canvas = canvasRef.current
    if (!canvas) return
    const width = Number.parseInt(settings.exportWidth, 10)
    const height = Number.parseInt(settings.exportHeight, 10)
    const dpi = Number.parseInt(settings.exportDPI, 10)
    if (!(width >= 1) || !(height >= 1)) {
      notify('尺寸不能小於 1', 'danger')
      return
    }
    try {
      await exportCanvas(canvas, format, width, height, dpi, settings.exportUnit)
    } catch (error) {
      notify(error instanceof Error ? error.message : '匯出失敗', 'danger')
    }
  }

  function saveNow() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const saved = writeSettings(settings)
    notify(saved ? '設定已儲存！' : '儲存設定失敗', saved ? 'success' : 'danger')
  }

  function loadSaved() {
    const saved = readSettings()
    if (saved === 'empty') return
    if (saved === 'error') {
      notify('載入設定失敗', 'danger')
      return
    }
    setSettings(saved)
    notify('設定已載入！', 'success')
  }

  function reset() {
    if (!window.confirm('確定要重置所有設定嗎？此操作無法復原。')) return
    clearSettings()
    setSettings(DEFAULT_SETTINGS)
    setPreset('')
    notify('設定已重置！', 'success')
  }

  const needsKey = settings.bgMethod === 'remove-bg' || settings.bgMethod === 'clipdrop' || settings.bgMethod === 'replicate'

  return (
    <div className="paint">
      {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
      <div className="paint-layout">
        <div className="paint-controls">
          <Banner tone="info" title="使用提示">
            <ul className="paint-tips">
              <li>按 Ctrl+V 貼上圖像</li>
              <li>拖拽圖像到畫布，或使用開啟圖像</li>
              <li>開啟繪製模式後再在畫布上畫</li>
              <li>選擇工具、顏色和大小</li>
            </ul>
          </Banner>

          <section className="paint-card">
            <h2>圖像操作</h2>
            <div className="paint-actions">
              <Button onClick={() => void pasteImage()}>貼上圖像（Ctrl+V）</Button>
              <Button variant="ghost" onClick={clearCanvas}>清除畫布</Button>
            </div>
            <FileInput label="開啟圖像" accept="image/*" onFiles={(files) => {
              const file = files[0]
              if (file?.type.startsWith('image/')) loadBlob(file)
            }} />
            <Select
              label="去背景方法"
              value={settings.bgMethod}
              options={METHODS}
              onChange={(event) => setSettings((current) => ({ ...current, bgMethod: event.target.value as BgMethod }))}
            />
            {needsKey ? (
              <>
                <Banner tone="warning" title="AI 去背景服務">
                  <ul className="paint-tips">
                    <li>Remove.bg：專業去背景，每月免費額度</li>
                    <li>ClipDrop：高品質 AI 處理</li>
                    <li>Replicate：開源模型，靈活配置</li>
                  </ul>
                  <Button variant="ghost" onClick={() => setHelpOpen(true)}>查看說明</Button>
                </Banner>
                <Field
                  label="API Key"
                  type="password"
                  value={settings.apiKey}
                  placeholder="輸入您的 API Key"
                  autoComplete="off"
                  onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))}
                />
              </>
            ) : null}
            <Button variant="danger" disabled={busy} onClick={() => void removeBackground()}>去背景</Button>
          </section>

          <section className="paint-card">
            <h2>繪製工具</h2>
            <div className="paint-tools" role="group" aria-label="工具選擇">
              <Button active={settings.currentTool === 'brush'} onClick={() => setSettings((current) => ({ ...current, currentTool: 'brush' }))}>畫筆</Button>
              <Button active={settings.currentTool === 'eraser'} variant="ghost" onClick={() => setSettings((current) => ({ ...current, currentTool: 'eraser' }))}>橡皮擦</Button>
            </div>
            <label className="paint-color">
              <span className={labelClass}>畫筆顏色</span>
              <span className="paint-color-row">
                <input
                  type="color"
                  value={settings.brushColor}
                  aria-label="畫筆顏色"
                  onChange={(event) => setSettings((current) => ({ ...current, brushColor: event.target.value }))}
                />
                <code>{settings.brushColor}</code>
              </span>
            </label>
            <div className="paint-sizes" role="group" aria-label="工具大小">
              {SIZES.map((item) => (
                <Button
                  key={item.size}
                  variant="ghost"
                  active={settings.brushSize === item.size}
                  onClick={() => setSettings((current) => ({ ...current, brushSize: item.size }))}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <Button active={drawingMode} onClick={() => setDrawingMode((value) => !value)}>
              {drawingMode ? '停止繪製' : '開始繪製'}
            </Button>
          </section>

          <section className="paint-card">
            <h2>匯出設定</h2>
            <Select
              label="尺寸單位"
              value={settings.exportUnit}
              options={UNITS}
              onChange={(event) => setSettings((current) => ({ ...current, exportUnit: event.target.value as ExportUnit }))}
            />
            <Field
              label="解析度 (DPI)"
              type="number"
              min={72}
              max={600}
              step={1}
              value={settings.exportDPI}
              onChange={(event) => setSettings((current) => ({ ...current, exportDPI: event.target.value }))}
            />
            <div className="paint-pair">
              <Field label="寬度" type="number" min={1} max={10000} step={1} value={settings.exportWidth} onChange={(event) => onWidth(event.target.value)} />
              <Field
                label="高度"
                type="number"
                min={1}
                max={10000}
                step={1}
                value={settings.exportHeight}
                onChange={(event) => {
                  setPreset('')
                  setSettings((current) => ({ ...current, exportHeight: event.target.value }))
                }}
              />
            </div>
            <Checkbox label="保持比例" checked={settings.keepAspectRatio} onChange={(event) => onKeep(event.target.checked)} />
            <div className="paint-presets" role="group" aria-label="預設尺寸">
              {PRESETS.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  active={preset === item.id}
                  onClick={() => {
                    setPreset(item.id)
                    setSettings((current) => ({
                      ...current,
                      exportWidth: String(item.width),
                      exportHeight: String(item.height),
                    }))
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="paint-exports">
              {FORMATS.map((format) => (
                <Button key={format.id} variant="ghost" onClick={() => void onExport(format.id)}>
                  {format.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="paint-card">
            <h2>設定管理</h2>
            <div className="paint-actions">
              <Button variant="ghost" onClick={saveNow}>儲存設定</Button>
              <Button variant="ghost" onClick={loadSaved}>載入設定</Button>
              <Button variant="danger" onClick={reset}>重置設定</Button>
            </div>
            <p className="paint-note">自動儲存已啟用，設定會存在這台瀏覽器的本地儲存。變更後約 2 秒自動儲存，每 5 分鐘再備份一次。</p>
          </section>
        </div>

        <div
          className={dragOver ? 'paint-stage is-drag' : 'paint-stage'}
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            setDragOver(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            const file = event.dataTransfer.files[0]
            if (file?.type.startsWith('image/')) loadBlob(file)
          }}
        >
          <canvas
            ref={canvasRef}
            className={drawingMode ? 'paint-canvas is-drawing' : 'paint-canvas'}
            aria-label="繪圖畫布"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stopPointer}
            onPointerCancel={stopPointer}
          />
          {!hasImage || dragOver ? (
            <div className="paint-drop">
              {dragOver ? <strong>放開以載入圖像</strong> : (
                <>
                  <strong>拖拽圖像到這裡</strong>
                  <p>或按 Ctrl+V 貼上圖像</p>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="paint-status" role="status">
        <span>畫布: {canvasSize.w} x {canvasSize.h}</span>
        <span>繪製模式: {drawingMode ? '開啟' : '關閉'}</span>
        {busy ? <span>處理中...</span> : null}
      </div>

      <Modal
        open={colorOpen}
        title="選擇要移除的背景顏色"
        onClose={() => setColorOpen(false)}
        footer={
          <>
            <Button onClick={() => void confirmBgColor()}>確認移除</Button>
            <Button variant="ghost" onClick={() => setColorOpen(false)}>取消</Button>
          </>
        }
      >
        <input className="paint-modal-color" type="color" value={bgColor} aria-label="背景顏色" onChange={(event) => setBgColor(event.target.value)} />
      </Modal>

      <Modal open={helpOpen} title="AI 去背景 API 設定" onClose={() => setHelpOpen(false)} footer={<Button onClick={() => setHelpOpen(false)}>了解</Button>}>
        <h3>Remove.bg API</h3>
        <ol className="paint-links">
          <li>前往 <a href="https://www.remove.bg/api" target="_blank" rel="noreferrer">remove.bg/api</a></li>
          <li>註冊帳號並獲取 API Key</li>
          <li>每月有免費額度</li>
        </ol>
        <h3>ClipDrop API</h3>
        <ol className="paint-links">
          <li>前往 <a href="https://clipdrop.co/api" target="_blank" rel="noreferrer">clipdrop.co/api</a></li>
          <li>註冊開發者帳號</li>
          <li>獲取 API Key</li>
        </ol>
        <h3>Replicate API</h3>
        <ol className="paint-links">
          <li>前往 <a href="https://replicate.com" target="_blank" rel="noreferrer">replicate.com</a></li>
          <li>註冊帳號並獲取 API Token</li>
          <li>支援多種開源模型</li>
        </ol>
      </Modal>
    </div>
  )
}
