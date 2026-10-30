import jsQR from 'jsqr'

export type QrHit = {
  data: string
}

const DEFAULT_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
}

export async function attachCamera(
  video: HTMLVideoElement,
  constraints: MediaTrackConstraints = DEFAULT_CONSTRAINTS,
): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('這個瀏覽器不支援攝影機')
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: constraints,
  })
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  await video.play()

  return () => {
    for (const track of stream.getTracks()) track.stop()
    if (video.srcObject === stream) video.srcObject = null
  }
}

export function startQrLoop(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  onHit: (hit: QrHit) => void,
): () => void {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('無法取得畫布內容')

  let frame = 0
  let stopped = false

  const tick = () => {
    if (stopped) return
    const width = video.videoWidth
    const height = video.videoHeight
    if (width > 0 && height > 0) {
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      context.drawImage(video, 0, 0, width, height)
      const image = context.getImageData(0, 0, width, height)
      const code = jsQR(image.data, image.width, image.height, {
        inversionAttempts: 'dontInvert',
      })
      if (code) onHit({ data: code.data })
    }
    frame = requestAnimationFrame(tick)
  }

  frame = requestAnimationFrame(tick)
  return () => {
    stopped = true
    cancelAnimationFrame(frame)
  }
}
