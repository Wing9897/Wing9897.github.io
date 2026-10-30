import { downloadFile } from '@/lib'

export function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('無法取得畫布')
  return context
}

export function removeColorRange(
  data: Uint8ClampedArray,
  minColor: [number, number, number],
  maxColor: [number, number, number],
  tolerance: number,
): void {
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0
    const green = data[index + 1] ?? 0
    const blue = data[index + 2] ?? 0
    if (
      red >= minColor[0] - tolerance &&
      red <= maxColor[0] + tolerance &&
      green >= minColor[1] - tolerance &&
      green <= maxColor[1] + tolerance &&
      blue >= minColor[2] - tolerance &&
      blue <= maxColor[2] + tolerance
    ) {
      data[index + 3] = 0
    }
  }
}

function detectEdges(data: Uint8ClampedArray, width: number, height: number): boolean[] {
  const edges = new Array<boolean>(data.length / 4).fill(false)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4
      const gx = Math.abs((data[index + 4] ?? 0) - (data[index - 4] ?? 0))
      const gy = Math.abs((data[index + width * 4] ?? 0) - (data[index - width * 4] ?? 0))
      if (Math.sqrt(gx * gx + gy * gy) > 30) edges[y * width + x] = true
    }
  }
  return edges
}

function isBackgroundColor(red: number, green: number, blue: number): boolean {
  const brightness = (red + green + blue) / 3
  const saturation = Math.max(red, green, blue) - Math.min(red, green, blue)
  return brightness > 200 && saturation < 50
}

function createBackgroundMask(data: Uint8ClampedArray, width: number, height: number): boolean[] {
  const mask = new Array<boolean>((data.length / 4) | 0).fill(false)
  const visited = new Array<boolean>((data.length / 4) | 0).fill(false)
  const queue: Array<[number, number]> = []
  for (let x = 0; x < width; x += 1) {
    queue.push([x, 0], [x, height - 1])
  }
  for (let y = 0; y < height; y += 1) {
    queue.push([0, y], [width - 1, y])
  }

  let head = 0
  while (head < queue.length) {
    const point = queue[head]
    head += 1
    if (!point) continue
    const [x, y] = point
    const index = y * width + x
    if (visited[index]) continue
    visited[index] = true
    const pixel = index * 4
    const red = data[pixel] ?? 0
    const green = data[pixel + 1] ?? 0
    const blue = data[pixel + 2] ?? 0
    if (!isBackgroundColor(red, green, blue)) continue
    mask[index] = true
    const neighbors: Array<[number, number]> = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]
    for (const neighbor of neighbors) {
      const [nx, ny] = neighbor
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) queue.push([nx, ny])
    }
  }
  return mask
}

export function removeAdvancedBackground(data: Uint8ClampedArray, width: number, height: number): void {
  const edges = detectEdges(data, width, height)
  const background = createBackgroundMask(data, width, height)
  for (let index = 0; index < data.length; index += 4) {
    const pixel = index / 4
    if (background[pixel] && !edges[pixel]) data[index + 3] = 0
  }
}

export function editPixels(
  canvas: HTMLCanvasElement,
  edit: (data: Uint8ClampedArray, width: number, height: number) => void,
): void {
  const context = contextOf(canvas)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  edit(imageData.data, canvas.width, canvas.height)
  context.putImageData(imageData, 0, 0)
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result?.[1] || !result[2] || !result[3]) return null
  return {
    r: Number.parseInt(result[1], 16),
    g: Number.parseInt(result[2], 16),
    b: Number.parseInt(result[3], 16),
  }
}

export function convertToPixels(value: number, unit: string, dpi: number): number {
  switch (unit) {
    case 'px':
      return value
    case 'cm':
      return Math.round((value * dpi) / 2.54)
    case 'mm':
      return Math.round((value * dpi) / 25.4)
    case 'in':
      return Math.round(value * dpi)
    case 'pt':
      return Math.round((value * dpi) / 72)
    default:
      return value
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('無法匯出圖像'))
      },
      type,
      quality,
    )
  })
}

export function buildSvg(canvas: HTMLCanvasElement, width: number, height: number, unit: string): string {
  const dataUrl = canvas.toDataURL('image/png')
  return `<svg width="${width}${unit}" height="${height}${unit}" xmlns="http://www.w3.org/2000/svg">
                <image href="${dataUrl}" width="${width}${unit}" height="${height}${unit}"/>
            </svg>`
}

export async function exportCanvas(
  source: HTMLCanvasElement,
  format: 'svg' | 'png' | 'jpg' | 'webp' | 'pdf',
  width: number,
  height: number,
  dpi: number,
  unit: string,
): Promise<void> {
  if (!(width >= 1) || !(height >= 1)) throw new Error('尺寸不能小於 1')
  if (format === 'svg') {
    downloadFile(buildSvg(source, width, height, unit), 'image.svg', 'image/svg+xml')
    return
  }

  const actualWidth = convertToPixels(width, unit, dpi)
  const actualHeight = convertToPixels(height, unit, dpi)
  if (!(actualWidth >= 1) || !(actualHeight >= 1)) throw new Error('尺寸不能小於 1')

  const temp = document.createElement('canvas')
  temp.width = actualWidth
  temp.height = actualHeight
  const context = temp.getContext('2d')
  if (!context) throw new Error('無法建立匯出畫布')
  context.drawImage(source, 0, 0, actualWidth, actualHeight)

  if (format === 'pdf') {
    const blob = await canvasBlob(temp, 'image/png')
    downloadFile(blob, 'image.pdf', 'application/pdf')
    return
  }

  const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
  const filename = format === 'jpg' ? 'image.jpg' : format === 'webp' ? 'image.webp' : 'image.png'
  const blob = await canvasBlob(temp, mime, format === 'png' ? undefined : 0.9)
  downloadFile(blob, filename)
}

async function canvasPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await canvasBlob(canvas, 'image/png')
  return blob
}

function drawResult(canvas: HTMLCanvasElement, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const context = contextOf(canvas)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      resolve()
    }
    image.onerror = () => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      reject(new Error('無法載入處理結果'))
    }
    image.src = url
  })
}

export async function removeBackgroundWithAi(
  canvas: HTMLCanvasElement,
  method: 'remove-bg' | 'clipdrop' | 'replicate',
  apiKey: string,
): Promise<void> {
  const imageBlob = await canvasPngBlob(canvas)
  let result = ''
  if (method === 'remove-bg') result = await callRemoveBg(imageBlob, apiKey)
  else if (method === 'clipdrop') result = await callClipDrop(imageBlob, apiKey)
  else result = await callReplicate(imageBlob, apiKey)
  await drawResult(canvas, result)
}

async function callRemoveBg(imageBlob: Blob, apiKey: string): Promise<string> {
  const formData = new FormData()
  formData.append('image_file', imageBlob, 'image.png')
  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: formData,
  })
  if (!response.ok) throw new Error(`Remove.bg API 錯誤: ${response.status}`)
  return URL.createObjectURL(await response.blob())
}

async function callClipDrop(imageBlob: Blob, apiKey: string): Promise<string> {
  const formData = new FormData()
  formData.append('image', imageBlob)
  const response = await fetch('https://clipdrop-api.co/remove-background/v1', {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: formData,
  })
  if (!response.ok) throw new Error(`ClipDrop API 錯誤: ${response.status}`)
  return URL.createObjectURL(await response.blob())
}

async function fileToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('無法讀取圖像'))
    reader.readAsDataURL(blob)
  })
  return dataUrl.split(',')[1] ?? ''
}

function replicateUrl(output: unknown): string {
  if (typeof output === 'string' && output) return output
  if (Array.isArray(output) && typeof output[0] === 'string' && output[0]) return output[0]
  throw new Error('Replicate 未回傳圖像網址')
}

async function callReplicate(imageBlob: Blob, apiKey: string): Promise<string> {
  const base64 = await fileToBase64(imageBlob)
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec0c003',
      input: { image: `data:image/png;base64,${base64}` },
    }),
  })
  if (!response.ok) throw new Error(`Replicate API 錯誤: ${response.status}`)
  const prediction = (await response.json()) as { urls?: { get?: string } }
  const statusUrl = prediction.urls?.get
  if (!statusUrl) throw new Error('Replicate 未回傳查詢網址')

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000))
    const statusResponse = await fetch(statusUrl, { headers: { Authorization: `Token ${apiKey}` } })
    const status = (await statusResponse.json()) as { status?: string; output?: unknown }
    if (status.status === 'succeeded') return replicateUrl(status.output)
    if (status.status === 'failed') throw new Error('Replicate 處理失敗')
  }
  throw new Error('Replicate 處理超時')
}
